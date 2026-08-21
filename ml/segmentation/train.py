#!/usr/bin/env python3
"""Run a bounded case-level 2D whole-tumor segmentation smoke experiment.

This educational pipeline uses the four Task01 MRI channels and binarises its
labels (edema, non-enhancing, enhancing) into a whole-tumor target. It is not a
subregion model, a clinical model, or a deployment workflow.
"""

from __future__ import annotations

import argparse
import json
import random
import time
from dataclasses import dataclass
from pathlib import Path

import nibabel as nib
import numpy as np
import torch
from sklearn.metrics import precision_score, recall_score
from torch import nn
from torch.nn import functional as F
from torch.utils.data import DataLoader, Dataset


def set_seed(seed: int) -> None:
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    torch.backends.cudnn.deterministic = True; torch.backends.cudnn.benchmark = False


@dataclass(frozen=True)
class SliceRef:
    image: Path
    label: Path
    slice_index: int
    case_id: str


def case_id(path: str) -> str:
    return Path(path).name.removesuffix(".nii.gz").removesuffix(".nii")


def select_slices(root: Path, case_pairs: list[tuple[str, str]], per_case: int) -> list[SliceRef]:
    selected: list[SliceRef] = []
    for image_relative, label_relative in case_pairs:
        image_path, label_path = root / image_relative.removeprefix("./"), root / label_relative.removeprefix("./")
        label = np.asarray(nib.load(str(label_path)).dataobj) > 0
        positive = np.flatnonzero(label.any(axis=(0, 1))).tolist()
        if not positive:
            continue
        chosen = positive if len(positive) <= per_case else [positive[index] for index in np.linspace(0, len(positive) - 1, per_case, dtype=int)]
        selected.extend(SliceRef(image_path, label_path, int(index), case_id(image_relative)) for index in chosen)
    return selected


class TumorSliceDataset(Dataset):
    def __init__(self, refs: list[SliceRef], size: int): self.refs, self.size = refs, size
    def __len__(self) -> int: return len(self.refs)
    def __getitem__(self, index: int):
        ref = self.refs[index]
        image = np.asarray(nib.load(str(ref.image)).dataobj[:, :, ref.slice_index, :], dtype=np.float32).transpose(2, 0, 1)
        target = np.asarray(nib.load(str(ref.label)).dataobj[:, :, ref.slice_index] > 0, dtype=np.float32)[None, ...]
        for channel in range(image.shape[0]):
            nonzero = image[channel][image[channel] != 0]
            if nonzero.size: image[channel] = (image[channel] - nonzero.mean()) / max(float(nonzero.std()), 1e-6)
        image_tensor = torch.from_numpy(image)[None, ...]
        target_tensor = torch.from_numpy(target)[None, ...]
        return F.interpolate(image_tensor, size=(self.size, self.size), mode="bilinear", align_corners=False).squeeze(0), F.interpolate(target_tensor, size=(self.size, self.size), mode="nearest").squeeze(0)


class TinyUNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.down1 = nn.Sequential(nn.Conv2d(4, 16, 3, padding=1), nn.ReLU(), nn.Conv2d(16, 16, 3, padding=1), nn.ReLU())
        self.pool = nn.MaxPool2d(2)
        self.down2 = nn.Sequential(nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.Conv2d(32, 32, 3, padding=1), nn.ReLU())
        self.up = nn.ConvTranspose2d(32, 16, 2, stride=2)
        self.out = nn.Sequential(nn.Conv2d(32, 16, 3, padding=1), nn.ReLU(), nn.Conv2d(16, 1, 1))
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        first = self.down1(x); second = self.down2(self.pool(first)); return self.out(torch.cat((self.up(second), first), dim=1))


def dice_loss(logits: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
    probabilities = torch.sigmoid(logits); smooth = 1.0
    intersection = (probabilities * target).sum(dim=(1, 2, 3)); denominator = probabilities.sum(dim=(1, 2, 3)) + target.sum(dim=(1, 2, 3))
    return 1 - ((2 * intersection + smooth) / (denominator + smooth)).mean()


def evaluate(model: nn.Module, loader: DataLoader, device: torch.device) -> dict[str, float]:
    model.eval(); dices, predictions, targets = [], [], []
    with torch.inference_mode():
        for image, target in loader:
            logits = model(image.to(device)); predicted = (torch.sigmoid(logits) >= 0.5).float().cpu(); target = target.float()
            intersection = (predicted * target).sum(dim=(1, 2, 3)); denominator = predicted.sum(dim=(1, 2, 3)) + target.sum(dim=(1, 2, 3)); dices.extend(((2 * intersection + 1) / (denominator + 1)).tolist())
            predictions.extend(predicted.flatten().int().tolist()); targets.extend(target.flatten().int().tolist())
    return {"mean_slice_dice": float(np.mean(dices)), "pixel_precision": precision_score(targets, predictions, zero_division=0), "pixel_recall": recall_score(targets, predictions, zero_division=0)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--train-cases", type=int, default=6)
    parser.add_argument("--validation-cases", type=int, default=2)
    parser.add_argument("--slices-per-case", type=int, default=12)
    parser.add_argument("--image-size", type=int, default=128)
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--seed", type=int, default=20260821)
    args = parser.parse_args(); set_seed(args.seed); args.output.mkdir(parents=True, exist_ok=True)
    metadata = json.loads((args.dataset_root / "dataset.json").read_text(encoding="utf-8"))
    pairs = [(entry["image"], entry["label"]) for entry in metadata["training"]]
    random.Random(args.seed).shuffle(pairs)
    validation_pairs, train_pairs = pairs[:args.validation_cases], pairs[args.validation_cases:args.validation_cases + args.train_cases]
    train_refs, validation_refs = select_slices(args.dataset_root, train_pairs, args.slices_per_case), select_slices(args.dataset_root, validation_pairs, args.slices_per_case)
    if not train_refs or not validation_refs: raise SystemExit("Selection did not yield tumor-positive training and validation slices")
    train_loader = DataLoader(TumorSliceDataset(train_refs, args.image_size), batch_size=args.batch_size, shuffle=True, num_workers=0)
    validation_loader = DataLoader(TumorSliceDataset(validation_refs, args.image_size), batch_size=args.batch_size, shuffle=False, num_workers=0)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu"); model = TinyUNet().to(device); optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate)
    history = []; start = time.perf_counter()
    for epoch in range(1, args.epochs + 1):
        model.train(); losses = []
        for image, target in train_loader:
            image, target = image.to(device), target.to(device); optimizer.zero_grad(); logits = model(image); loss = 0.5 * nn.BCEWithLogitsLoss()(logits, target) + 0.5 * dice_loss(logits, target); loss.backward(); optimizer.step(); losses.append(float(loss.item()))
        history.append({"epoch": epoch, "train_loss": float(np.mean(losses)), "validation": evaluate(model, validation_loader, device)})
    checkpoint = args.output / "tiny_unet_whole_tumor.pt"; torch.save({"architecture": "TinyUNet2D", "input_modalities": metadata["modality"], "target": "whole_tumor_binary", "image_size": args.image_size, "state_dict": model.state_dict()}, checkpoint)
    result = {"experiment_type": "bounded 2D whole-tumor segmentation smoke experiment", "dataset": {"name": metadata["name"], "release": metadata["release"], "licence": metadata["licence"], "source_training_cases": metadata["numTraining"], "source_test_cases": metadata["numTest"]}, "seed": args.seed, "train_cases": [case_id(image) for image, _ in train_pairs], "validation_cases": [case_id(image) for image, _ in validation_pairs], "train_slice_count": len(train_refs), "validation_slice_count": len(validation_refs), "epochs": args.epochs, "image_size": args.image_size, "elapsed_seconds": time.perf_counter() - start, "history": history, "checkpoint": str(checkpoint), "important_limitations": ["The target is binary whole tumor, combining edema, non-enhancing tumor, and enhancing tumor; no individual subregion metric was estimated.", "This is a small 2D slice smoke experiment on an openly available glioma-focused dataset, not a full 3D model.", "Evaluation is limited to selected labelled validation slices and is not a hidden test-set or clinical result.", "The checkpoint is not approved for dashboard inference or deployment."]}
    (args.output / "metrics.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"validation": history[-1]["validation"], "train_slices": len(train_refs), "validation_slices": len(validation_refs), "metrics": str(args.output / "metrics.json")}, indent=2))


if __name__ == "__main__": main()

