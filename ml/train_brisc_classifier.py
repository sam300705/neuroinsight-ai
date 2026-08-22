"""Run a separately gated BRISC image-level classification experiment.

This runner reads only the sanitised manifests created by build_brisc_splits.py. It selects the
best checkpoint by validation macro-F1 and evaluates the official test split once afterwards.
It writes all checkpoints and metrics to an external output directory and never changes the live
Mode A service.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
import time
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from sklearn.metrics import accuracy_score, classification_report, f1_score
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms


LABELS = ["glioma", "meningioma", "no_tumor", "pituitary"]


def normalise_label(value: str) -> str:
    return value.strip().lower().replace(" ", "_")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def load_rows(path: Path, limit_per_class: int | None = None) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    rows = [row for row in rows if normalise_label(row["tumor_label"]) in LABELS]
    if limit_per_class is None:
        return rows
    selected: list[dict[str, str]] = []
    for label in LABELS:
        selected.extend(
            sorted(
                (row for row in rows if normalise_label(row["tumor_label"]) == label),
                key=lambda row: row["relative_path"],
            )[:limit_per_class]
        )
    return selected


class BriscDataset(Dataset):
    def __init__(self, rows: list[dict[str, str]], root: Path, transform: transforms.Compose):
        self.rows = rows
        self.root = root
        self.transform = transform

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, int]:
        row = self.rows[index]
        relative_path = row["relative_path"].replace("\\", "/")
        with Image.open(self.root / relative_path) as image:
            tensor = self.transform(image.convert("RGB"))
        return tensor, LABELS.index(normalise_label(row["tumor_label"]))


def create_model(pretrained: bool) -> tuple[nn.Module, str]:
    weights = models.ResNet18_Weights.IMAGENET1K_V1 if pretrained else None
    model = models.resnet18(weights=weights)
    model.fc = nn.Linear(model.fc.in_features, len(LABELS))
    for parameter in model.parameters():
        parameter.requires_grad = False
    for parameter in model.fc.parameters():
        parameter.requires_grad = True
    return model, "ResNet18_Weights.IMAGENET1K_V1" if pretrained else "none"


def evaluate(model: nn.Module, loader: DataLoader, device: torch.device) -> dict[str, object]:
    model.eval()
    predictions: list[int] = []
    targets: list[int] = []
    logits_all: list[list[float]] = []
    criterion = nn.CrossEntropyLoss()
    total_loss = 0.0
    with torch.inference_mode():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            logits = model(images)
            total_loss += criterion(logits, labels).item() * labels.size(0)
            predictions.extend(logits.argmax(dim=1).cpu().tolist())
            targets.extend(labels.cpu().tolist())
            logits_all.extend(logits.cpu().tolist())
    return {
        "loss": total_loss / max(1, len(targets)),
        "accuracy": float(accuracy_score(targets, predictions)),
        "macro_f1": float(f1_score(targets, predictions, average="macro", zero_division=0)),
        "weighted_f1": float(f1_score(targets, predictions, average="weighted", zero_division=0)),
        "classification_report": classification_report(
            targets,
            predictions,
            labels=list(range(len(LABELS))),
            target_names=LABELS,
            zero_division=0,
            output_dict=True,
        ),
        "sample_count": len(targets),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--split-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--image-size", type=int, default=128)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--seed", type=int, default=20260823)
    parser.add_argument("--train-limit-per-class", type=int)
    parser.add_argument("--validation-limit-per-class", type=int)
    parser.add_argument("--test-limit-per-class", type=int)
    parser.add_argument("--pretrained", action="store_true")
    args = parser.parse_args()

    seed_everything(args.seed)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    train_manifest = args.split_dir / "classification_train.csv"
    validation_manifest = args.split_dir / "classification_validation.csv"
    test_manifest = args.split_dir / "classification_official_test.csv"
    train_rows = load_rows(train_manifest, args.train_limit_per_class)
    validation_rows = load_rows(validation_manifest, args.validation_limit_per_class)
    test_rows = load_rows(test_manifest, args.test_limit_per_class)
    if not train_rows or not validation_rows or not test_rows:
        raise SystemExit("Sanitised train, validation, and official test rows are all required.")

    normalise = transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    train_transform = transforms.Compose(
        [
            transforms.Resize((args.image_size, args.image_size)),
            transforms.RandomRotation(7),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.ToTensor(),
            normalise,
        ]
    )
    evaluation_transform = transforms.Compose(
        [transforms.Resize((args.image_size, args.image_size)), transforms.ToTensor(), normalise]
    )
    train_loader = DataLoader(BriscDataset(train_rows, args.dataset_root, train_transform), batch_size=args.batch_size, shuffle=True, num_workers=0)
    validation_loader = DataLoader(BriscDataset(validation_rows, args.dataset_root, evaluation_transform), batch_size=args.batch_size, shuffle=False, num_workers=0)
    test_loader = DataLoader(BriscDataset(test_rows, args.dataset_root, evaluation_transform), batch_size=args.batch_size, shuffle=False, num_workers=0)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model, weights_source = create_model(args.pretrained)
    model.to(device)
    optimizer = torch.optim.AdamW(model.fc.parameters(), lr=args.learning_rate, weight_decay=0.01)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=1)
    criterion = nn.CrossEntropyLoss()
    best_state: dict[str, torch.Tensor] | None = None
    best_epoch = 0
    best_validation = {"macro_f1": -1.0}
    history = []
    started_at = time.perf_counter()

    for epoch in range(1, args.epochs + 1):
        model.train()
        train_loss, train_count = 0.0, 0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            logits = model(images)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * labels.size(0)
            train_count += labels.size(0)
        validation = evaluate(model, validation_loader, device)
        scheduler.step(float(validation["macro_f1"]))
        history.append(
            {
                "epoch": epoch,
                "train_loss": train_loss / max(1, train_count),
                "validation": validation,
                "learning_rate": optimizer.param_groups[0]["lr"],
            }
        )
        if float(validation["macro_f1"]) > float(best_validation["macro_f1"]):
            best_validation = validation
            best_epoch = epoch
            best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}

    if best_state is None:
        raise RuntimeError("No validation checkpoint was selected.")
    model.load_state_dict(best_state)
    test_metrics = evaluate(model, test_loader, device)
    checkpoint = args.output_dir / "resnet18_head_only.pt"
    torch.save(
        {
            "architecture": "resnet18",
            "head_only": True,
            "labels": LABELS,
            "image_size": args.image_size,
            "state_dict": best_state,
        },
        checkpoint,
    )
    metrics = {
        "experiment_type": "separate BRISC head-only research experiment",
        "evaluation_unit": "sanitised fixed image-level split; patient identifiers unavailable",
        "model": "resnet18",
        "head_only": True,
        "weights_source": weights_source,
        "device": str(device),
        "seed": args.seed,
        "epochs_requested": args.epochs,
        "best_validation_epoch": best_epoch,
        "batch_size": args.batch_size,
        "image_size": args.image_size,
        "learning_rate": args.learning_rate,
        "manifest_sha256": {
            "train": sha256_file(train_manifest),
            "validation": sha256_file(validation_manifest),
            "official_test": sha256_file(test_manifest),
        },
        "sample_counts": {"train": len(train_rows), "validation": len(validation_rows), "official_test": len(test_rows)},
        "class_counts": {
            "train": dict(Counter(normalise_label(row["tumor_label"]) for row in train_rows)),
            "validation": dict(Counter(normalise_label(row["tumor_label"]) for row in validation_rows)),
            "official_test": dict(Counter(normalise_label(row["tumor_label"]) for row in test_rows)),
        },
        "history": history,
        "best_validation": best_validation,
        "official_test": test_metrics,
        "elapsed_seconds": time.perf_counter() - started_at,
        "checkpoint": str(checkpoint),
        "checkpoint_sha256": sha256_file(checkpoint),
        "limitations": [
            "This is a separate image-level experiment; BRISC lacks patient identifiers and does not support patient-independent claims.",
            "The official test partition was not used for checkpoint selection, early stopping, or hyperparameter selection.",
            "This output does not change the deployed EXP-005 model or activate Mode B segmentation.",
            "No clinical, diagnostic, external-validation, or medical-probability claim may be made from these results.",
        ],
    }
    (args.output_dir / "metrics.json").write_text(json.dumps(metrics, indent=2, default=float), encoding="utf-8")
    print(
        json.dumps(
            {
                "best_validation_epoch": best_epoch,
                "validation_accuracy": best_validation["accuracy"],
                "validation_macro_f1": best_validation["macro_f1"],
                "official_test_accuracy": test_metrics["accuracy"],
                "official_test_macro_f1": test_metrics["macro_f1"],
                "elapsed_seconds": metrics["elapsed_seconds"],
                "metrics": str(args.output_dir / "metrics.json"),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
