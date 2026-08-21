#!/usr/bin/env python3
"""Train a bounded, reproducible four-class image-classification experiment.

The runner expects a deduplicated manifest with `audit_split`. Its split is an
exact-image-hash grouping fallback, not a patient-level split, so output metrics
are explicitly labelled development-only and must not be described as clinical or
patient-level performance.
"""

from __future__ import annotations

import argparse
import csv
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

LABELS = ["glioma", "meningioma", "notumor", "pituitary"]


class ManifestDataset(Dataset):
    def __init__(self, rows: list[dict[str, str]], root: Path, transform: transforms.Compose):
        self.rows, self.root, self.transform = rows, root, transform

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int):
        row = self.rows[index]
        with Image.open(self.root / row["file_path"]) as image:
            image = image.convert("RGB")
            tensor = self.transform(image)
        return tensor, LABELS.index(row["label"])


def seeded(seed: int) -> None:
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    if torch.cuda.is_available(): torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True; torch.backends.cudnn.benchmark = False


def select_rows(manifest: Path, split: str, limit_per_class: int | None) -> list[dict[str, str]]:
    with manifest.open(newline="", encoding="utf-8") as file:
        rows = [row for row in csv.DictReader(file) if row["audit_split"] == split]
    if limit_per_class is None: return rows
    selected: list[dict[str, str]] = []
    for label in LABELS:
        selected.extend(sorted((row for row in rows if row["label"] == label), key=lambda row: row["file_path"])[:limit_per_class])
    return selected


def create_model(architecture: str, pretrained: bool) -> tuple[nn.Module, str]:
    if architecture == "resnet50":
        weights = models.ResNet50_Weights.IMAGENET1K_V2 if pretrained else None
        model = models.resnet50(weights=weights)
        model.fc = nn.Linear(model.fc.in_features, len(LABELS))
        return model, "ResNet50_Weights.IMAGENET1K_V2" if pretrained else "none"
    if architecture == "efficientnet_b0":
        weights = models.EfficientNet_B0_Weights.IMAGENET1K_V1 if pretrained else None
        model = models.efficientnet_b0(weights=weights)
        model.classifier[1] = nn.Linear(model.classifier[1].in_features, len(LABELS))
        return model, "EfficientNet_B0_Weights.IMAGENET1K_V1" if pretrained else "none"
    raise ValueError(f"Unsupported architecture: {architecture}")


def freeze_backbone(model: nn.Module, architecture: str) -> None:
    for parameter in model.parameters(): parameter.requires_grad = False
    head = model.fc if architecture == "resnet50" else model.classifier
    for parameter in head.parameters(): parameter.requires_grad = True


def evaluate(model: nn.Module, loader: DataLoader, device: torch.device) -> dict[str, object]:
    model.eval(); predictions, targets = [], []; total_loss = 0.0; criterion = nn.CrossEntropyLoss()
    with torch.inference_mode():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            logits = model(images); total_loss += criterion(logits, labels).item() * labels.size(0)
            predictions.extend(logits.argmax(dim=1).cpu().tolist()); targets.extend(labels.cpu().tolist())
    return {"loss": total_loss / max(1, len(targets)), "accuracy": accuracy_score(targets, predictions), "macro_f1": f1_score(targets, predictions, average="macro", zero_division=0), "weighted_f1": f1_score(targets, predictions, average="weighted", zero_division=0), "classification_report": classification_report(targets, predictions, labels=list(range(len(LABELS))), target_names=LABELS, zero_division=0, output_dict=True)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--architecture", choices=["resnet50", "efficientnet_b0"], required=True)
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--image-size", type=int, default=128)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--limit-per-class", type=int)
    parser.add_argument("--seed", type=int, default=20260821)
    parser.add_argument("--pretrained", action="store_true")
    args = parser.parse_args()
    seeded(args.seed); args.output.mkdir(parents=True, exist_ok=True)
    train_rows, validation_rows = select_rows(args.manifest, "train", args.limit_per_class), select_rows(args.manifest, "validation", args.limit_per_class)
    if not train_rows or not validation_rows: raise SystemExit("Both train and validation rows are required")
    image_size = args.image_size
    normalize = transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    train_transform = transforms.Compose([transforms.Resize((image_size, image_size)), transforms.RandomRotation(7), transforms.ToTensor(), normalize])
    validation_transform = transforms.Compose([transforms.Resize((image_size, image_size)), transforms.ToTensor(), normalize])
    train_loader = DataLoader(ManifestDataset(train_rows, args.dataset_root, train_transform), batch_size=args.batch_size, shuffle=True, num_workers=0)
    validation_loader = DataLoader(ManifestDataset(validation_rows, args.dataset_root, validation_transform), batch_size=args.batch_size, shuffle=False, num_workers=0)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model, weights_source = create_model(args.architecture, args.pretrained); model.to(device); freeze_backbone(model, args.architecture)
    optimizer = torch.optim.AdamW((parameter for parameter in model.parameters() if parameter.requires_grad), lr=args.learning_rate, weight_decay=0.01)
    criterion = nn.CrossEntropyLoss(); epoch_history = []; started_at = time.perf_counter()
    for epoch in range(1, args.epochs + 1):
        model.train(); cumulative_loss = 0.0; sample_count = 0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad(); logits = model(images); loss = criterion(logits, labels); loss.backward(); optimizer.step()
            cumulative_loss += loss.item() * labels.size(0); sample_count += labels.size(0)
        validation = evaluate(model, validation_loader, device)
        epoch_history.append({"epoch": epoch, "train_loss": cumulative_loss / max(1, sample_count), "validation": validation})
    checkpoint = args.output / f"{args.architecture}_head_only.pt"
    torch.save({"architecture": args.architecture, "labels": LABELS, "image_size": image_size, "state_dict": model.state_dict()}, checkpoint)
    metrics = {"experiment_type": "head-only transfer-learning smoke experiment", "architecture": args.architecture, "weights_source": weights_source, "device": str(device), "seed": args.seed, "epochs": args.epochs, "batch_size": args.batch_size, "image_size": image_size, "learning_rate": args.learning_rate, "train_samples": len(train_rows), "validation_samples": len(validation_rows), "train_class_counts": Counter(row["label"] for row in train_rows), "validation_class_counts": Counter(row["label"] for row in validation_rows), "elapsed_seconds": time.perf_counter() - started_at, "history": epoch_history, "checkpoint": str(checkpoint), "important_limitations": ["This experiment uses a deterministic exact-image-hash split because patient identifiers are absent; it is not patient-level evaluation.", "The supplied Mendeley train/test partition was rejected after exact duplicates were observed across its partitions.", "No held-out test metric was calculated in this experiment. Validation metrics are for development comparison only.", "No clinical or medical-diagnostic claim may be made from this result."]}
    (args.output / "metrics.json").write_text(json.dumps(metrics, indent=2, default=float), encoding="utf-8")
    print(json.dumps({"architecture": args.architecture, "validation_accuracy": epoch_history[-1]["validation"]["accuracy"], "validation_macro_f1": epoch_history[-1]["validation"]["macro_f1"], "elapsed_seconds": metrics["elapsed_seconds"], "metrics": str(args.output / "metrics.json")}, indent=2))


if __name__ == "__main__":
    main()

