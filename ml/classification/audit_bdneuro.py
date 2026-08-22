#!/usr/bin/env python3
"""Audit the official BDNeuro-MRI v7 fixed image-level split.

This utility deliberately does not infer or fabricate patient identifiers. It
verifies readable image files, exact content duplication, and near duplication
across the released train/validation/test folders, then writes an auditable
manifest suitable for the experimental trainer.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, UnidentifiedImageError

SPLIT_MAP = {"train": "train", "val": "validation", "test": "test"}
LABEL_MAP = {"glioma": "glioma", "meningioma": "meningioma", "pituitary": "pituitary", "no_tumor": "notumor"}
ALLOWED = {".jpg", ".jpeg", ".png"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def perceptual_hash(image: Image.Image) -> int:
    """Compute a 64-bit pHash with a fixed 32x32 DCT basis using NumPy only."""
    size, low_frequency = 32, 8
    gray = np.asarray(image.convert("L").resize((size, size)), dtype=np.float32)
    indices = np.arange(size, dtype=np.float32)
    basis = np.array(
        [[math.cos(math.pi * (2 * value + 1) * frequency / (2 * size)) for value in indices] for frequency in indices],
        dtype=np.float32,
    )
    basis[0] *= math.sqrt(1 / size)
    basis[1:] *= math.sqrt(2 / size)
    dct = basis @ gray @ basis.T
    low = dct[:low_frequency, :low_frequency]
    median = float(np.median(low[1:, :]))
    value = 0
    for bit in (low > median).ravel():
        value = (value << 1) | int(bit)
    return value


def cross_split_near_pairs(rows: list[dict[str, object]], threshold: int) -> list[dict[str, object]]:
    by_label: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        by_label[str(row["label"])].append(row)
    pairs: list[dict[str, object]] = []
    for label, candidates in by_label.items():
        for left_index, left in enumerate(candidates):
            for right in candidates[left_index + 1 :]:
                if left["audit_split"] == right["audit_split"]:
                    continue
                distance = (int(left["perceptual_hash"]) ^ int(right["perceptual_hash"])).bit_count()
                if distance <= threshold:
                    pairs.append({"label": label, "left": left["file_path"], "left_split": left["audit_split"], "right": right["file_path"], "right_split": right["audit_split"], "hamming_distance": distance})
    return pairs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--near-duplicate-threshold", type=int, default=5)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, object]] = []
    unreadable: list[str] = []
    for source_split, audit_split in SPLIT_MAP.items():
        for source_label, label in LABEL_MAP.items():
            directory = args.dataset_root / source_split / source_label
            if not directory.is_dir():
                raise SystemExit(f"Missing expected directory: {directory}")
            for path in sorted(directory.rglob("*")):
                if not path.is_file() or path.suffix.lower() not in ALLOWED:
                    continue
                relative = path.relative_to(args.dataset_root).as_posix()
                try:
                    with Image.open(path) as image:
                        image.load()
                        width, height = image.size
                        image_hash = perceptual_hash(image)
                except (UnidentifiedImageError, OSError, ValueError):
                    unreadable.append(relative)
                    continue
                rows.append({"file_path": relative, "label": label, "audit_split": audit_split, "source_split": source_split, "source_label": source_label, "width": width, "height": height, "sha256": sha256(path), "perceptual_hash": image_hash})

    by_hash: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        by_hash[str(row["sha256"])].append(row)
    exact_cross_split = [group for group in by_hash.values() if len({row["audit_split"] for row in group}) > 1]
    near_cross_split = cross_split_near_pairs(rows, args.near_duplicate_threshold)
    manifest = args.output_dir / "bdneuro_v7_manifest.csv"
    with manifest.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=["file_path", "label", "audit_split", "source_split", "source_label", "width", "height", "sha256", "perceptual_hash"])
        writer.writeheader()
        writer.writerows(rows)
    # Preserve the official held-out test split. For each cross-split perceptual
    # candidate, remove the more replaceable split member (train before
    # validation) from the training manifest. This is deliberately conservative:
    # perceptual similarity is a review signal, not proof of patient identity.
    removal_priority = {"train": 0, "validation": 1, "test": 2}
    excluded_paths: set[str] = set()
    for pair in near_cross_split:
        left = {"path": str(pair["left"]), "split": str(pair["left_split"])}
        right = {"path": str(pair["right"]), "split": str(pair["right_split"])}
        chosen = min((left, right), key=lambda item: removal_priority[item["split"]])
        if chosen["split"] != "test":
            excluded_paths.add(chosen["path"])
    sanitized_rows = [row for row in rows if str(row["file_path"]) not in excluded_paths]
    sanitized_manifest = args.output_dir / "bdneuro_v7_sanitized_manifest.csv"
    with sanitized_manifest.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=["file_path", "label", "audit_split", "source_split", "source_label", "width", "height", "sha256", "perceptual_hash"])
        writer.writeheader()
        writer.writerows(sanitized_rows)
    report = {
        "dataset": "BDNeuro-MRI v7",
        "evaluation_unit": "image-level fixed official split; patient identifiers unavailable",
        "dataset_root": str(args.dataset_root),
        "readable_images": len(rows),
        "unreadable_images": unreadable,
        "class_counts": Counter(str(row["label"]) for row in rows),
        "split_counts": Counter(str(row["audit_split"]) for row in rows),
        "split_class_counts": {split: Counter(str(row["label"]) for row in rows if row["audit_split"] == split) for split in sorted(SPLIT_MAP.values())},
        "exact_duplicate_groups_cross_split": exact_cross_split,
        "near_duplicate_review_pairs_cross_split": near_cross_split,
        "near_duplicate_hamming_threshold": args.near_duplicate_threshold,
        "sanitized_manifest": str(sanitized_manifest),
        "sanitized_excluded_paths": sorted(excluded_paths),
        "sanitized_split_counts": Counter(str(row["audit_split"]) for row in sanitized_rows),
        "important_limitations": ["No patient or case identifiers are retained by the public release.", "Zero image/content overlap does not establish patient-level independence.", "Results must be reported as fixed-split image-level experimental evaluation, not clinical validation."],
    }
    (args.output_dir / "bdneuro_v7_audit.json").write_text(json.dumps(report, indent=2, default=list), encoding="utf-8")
    print(json.dumps({"manifest": str(manifest), "sanitized_manifest": str(sanitized_manifest), "readable_images": len(rows), "excluded_training_or_validation_images": len(excluded_paths), "exact_cross_split_groups": len(exact_cross_split), "near_cross_split_review_pairs": len(near_cross_split)}, indent=2))


if __name__ == "__main__":
    main()
