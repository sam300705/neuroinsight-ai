#!/usr/bin/env python3
"""Fit post-hoc temperature scaling and an abstention threshold on validation data.

This produces bounded experimental calibration evidence only. It must never be
described as a medical probability or clinical calibration result.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms

from train import LABELS, create_model, seeded


class ValidationDataset(Dataset):
    def __init__(self, manifest: Path, root: Path, image_size: int):
        with manifest.open(newline="", encoding="utf-8") as stream:
            self.rows = [row for row in csv.DictReader(stream) if row["audit_split"] == "validation"]
        self.root = root
        self.transform = transforms.Compose([
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int):
        row = self.rows[index]
        with Image.open(self.root / row["file_path"]) as image:
            return self.transform(image.convert("RGB")), LABELS.index(row["label"])


def ece(probabilities: np.ndarray, labels: np.ndarray, bins: int = 15) -> float:
    confidence = probabilities.max(axis=1)
    prediction = probabilities.argmax(axis=1)
    total = len(labels)
    value = 0.0
    for lower in np.linspace(0, 1, bins, endpoint=False):
        upper = lower + 1 / bins
        mask = (confidence >= lower) & ((confidence < upper) if upper < 1 else (confidence <= upper))
        if not mask.any():
            continue
        value += mask.mean() * abs((prediction[mask] == labels[mask]).mean() - confidence[mask].mean())
    return float(value)


def brier(probabilities: np.ndarray, labels: np.ndarray) -> float:
    targets = np.eye(probabilities.shape[1])[labels]
    return float(np.mean(np.sum((probabilities - targets) ** 2, axis=1)))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--seed", type=int, default=20260821)
    args = parser.parse_args()
    seeded(args.seed)
    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    model, _ = create_model(str(checkpoint["architecture"]), pretrained=False)
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    dataset = ValidationDataset(args.manifest, args.dataset_root, int(checkpoint["image_size"]))
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=False, num_workers=0)
    logits, labels = [], []
    with torch.inference_mode():
        for images, targets in loader:
            logits.append(model(images)); labels.append(targets)
    logits_tensor = torch.cat(logits)
    labels_tensor = torch.cat(labels)
    log_temperature = torch.tensor(0.0, requires_grad=True)
    optimizer = torch.optim.LBFGS([log_temperature], lr=0.1, max_iter=50)
    criterion = nn.CrossEntropyLoss()
    def closure():
        optimizer.zero_grad()
        loss = criterion(logits_tensor / torch.exp(log_temperature), labels_tensor)
        loss.backward()
        return loss
    optimizer.step(closure)
    temperature = float(torch.exp(log_temperature).detach())
    raw_probabilities = torch.softmax(logits_tensor, dim=1).numpy()
    calibrated_probabilities = torch.softmax(logits_tensor / temperature, dim=1).numpy()
    targets = labels_tensor.numpy()
    thresholds = []
    for threshold in np.arange(0.35, 0.951, 0.01):
        accepted = calibrated_probabilities.max(axis=1) >= threshold
        if not accepted.any():
            continue
        thresholds.append({"threshold": round(float(threshold), 2), "coverage": float(accepted.mean()), "accepted_accuracy": float((calibrated_probabilities.argmax(axis=1)[accepted] == targets[accepted]).mean())})
    eligible = [item for item in thresholds if item["coverage"] >= 0.5 and item["accepted_accuracy"] >= 0.85]
    selected = max(eligible, key=lambda item: item["coverage"]) if eligible else max(thresholds, key=lambda item: item["accepted_accuracy"])
    result = {
        "method": "validation-only temperature scaling",
        "evaluation_unit": "image-level fixed official split; not patient-level or clinical calibration",
        "seed": args.seed,
        "validation_samples": len(dataset),
        "temperature": temperature,
        "raw_ece_15_bins": ece(raw_probabilities, targets),
        "calibrated_ece_15_bins": ece(calibrated_probabilities, targets),
        "raw_brier_multiclass": brier(raw_probabilities, targets),
        "calibrated_brier_multiclass": brier(calibrated_probabilities, targets),
        "abstention_policy": {"selection_rule": "maximum validation coverage with accepted-sample accuracy at least 0.85 and coverage at least 0.50", "threshold": selected["threshold"], "validation_coverage": selected["coverage"], "validation_accepted_accuracy": selected["accepted_accuracy"]},
        "limitations": ["This calibration is post-hoc and validation-only on a fixed image-level split.", "A calibrated model confidence score is not a medical probability.", "No patient-level, external, clinical, or prospective calibration was performed."],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
