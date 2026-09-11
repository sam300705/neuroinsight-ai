"""Audit an authorised local BRISC release without copying raw data into the repository.

This utility records manifest integrity, content readability, image/mask pairing, class counts,
exact duplicate groups, and conservative dHash near-duplicate review candidates. It does not
train a model or change any deployed service.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from itertools import combinations
from pathlib import Path

import numpy as np
from PIL import Image, UnidentifiedImageError


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}


@dataclass(frozen=True)
class Record:
    relative_path: str
    task: str
    split: str
    label: str
    is_mask: bool
    linked_image: str


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def resolve_path(root: Path, relative_path: str) -> Path:
    normalized = relative_path.replace("\\", "/")
    candidate = root / normalized
    if candidate.exists():
        return candidate
    without_root = Path(normalized)
    if without_root.parts and without_root.parts[0] == root.name:
        candidate = root.parent / without_root
        if candidate.exists():
            return candidate
    return candidate


def as_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes"}


def read_manifest(root: Path) -> list[Record]:
    manifest_path = root / "manifest.csv"
    records: list[Record] = []
    with manifest_path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            records.append(
                Record(
                    relative_path=(row.get("relative_path") or "").strip().replace("\\", "/"),
                    task=(row.get("task") or "").strip().lower(),
                    split=(row.get("split") or "").strip().lower(),
                    label=(row.get("tumor_label") or row.get("label") or "").strip().lower(),
                    is_mask=as_bool(row.get("is_mask") or ""),
                    linked_image=(row.get("linked_image") or "").strip().replace("\\", "/"),
                )
            )
    return records


def dhash64(path: Path) -> int:
    with Image.open(path) as image:
        grayscale = image.convert("L").resize((9, 8))
        pixels = list(grayscale.getdata())
    value = 0
    for row in range(8):
        for column in range(8):
            left = pixels[row * 9 + column]
            right = pixels[row * 9 + column + 1]
            value = (value << 1) | int(left > right)
    return value


def hamming(left: int, right: int) -> int:
    return (left ^ right).bit_count()


def find_review_pairs(hashes: dict[str, int], maximum_distance: int = 5) -> list[dict[str, object]]:
    """Find a conservative candidate set; candidates require human review, never automatic exclusion."""
    buckets: dict[tuple[int, int], list[str]] = defaultdict(list)
    for filename, fingerprint in hashes.items():
        for segment in range(8):
            buckets[(segment, (fingerprint >> (segment * 8)) & 0xFF)].append(filename)

    candidates: set[tuple[str, str]] = set()
    for members in buckets.values():
        if len(members) > 1:
            candidates.update(tuple(sorted(pair)) for pair in combinations(members, 2))

    review_pairs = []
    for left, right in sorted(candidates):
        distance = hamming(hashes[left], hashes[right])
        if distance <= maximum_distance:
            review_pairs.append({"left": left, "right": right, "dhash_distance": distance})
    return review_pairs


def image_similarity(left: Path, right: Path) -> dict[str, float]:
    """Return strict grayscale similarity features for already-screened candidate pairs."""
    with Image.open(left) as left_image, Image.open(right) as right_image:
        left_pixels = np.asarray(left_image.convert("L").resize((128, 128)), dtype=np.float32) / 255.0
        right_pixels = np.asarray(right_image.convert("L").resize((128, 128)), dtype=np.float32) / 255.0
    mae = float(np.mean(np.abs(left_pixels - right_pixels)))
    left_centered = left_pixels - left_pixels.mean()
    right_centered = right_pixels - right_pixels.mean()
    denominator = float(np.sqrt(np.sum(left_centered**2) * np.sum(right_centered**2)))
    correlation = float(np.sum(left_centered * right_centered) / denominator) if denominator else 0.0
    return {"normalized_mae": mae, "correlation": correlation}


def task_cross_split_groups(
    groups: list[list[str]], image_by_relative: dict[str, Record], task: str
) -> tuple[list[list[str]], list[str]]:
    task_groups = [[path for path in paths if image_by_relative[path].task == task] for paths in groups]
    task_groups = [paths for paths in task_groups if len(paths) > 1 and len({image_by_relative[path].split for path in paths}) > 1]
    train_exclusions = sorted({path for paths in task_groups for path in paths if image_by_relative[path].split == "train"})
    return task_groups, train_exclusions


def manifest_checksum_status(root: Path, filename: str) -> dict[str, str]:
    expected_path = root / f"{filename}.sha256"
    target = root / filename
    expected = expected_path.read_text(encoding="utf-8").split()[0] if expected_path.exists() else "missing"
    actual = sha256_file(target) if target.exists() else "missing"
    return {"expected": expected, "actual": actual, "status": "passed" if expected == actual else "failed"}


def audit(root: Path, output_dir: Path) -> dict[str, object]:
    records = read_manifest(root)
    output_dir.mkdir(parents=True, exist_ok=True)

    image_records = [record for record in records if not record.is_mask and Path(record.relative_path).suffix.lower() in IMAGE_SUFFIXES]
    mask_records = [record for record in records if record.is_mask]
    path_set = {record.relative_path for record in records}
    image_by_relative = {record.relative_path: record for record in image_records}
    class_counts = Counter((record.split, record.label) for record in image_records if record.task == "classification")
    task_counts = Counter(record.task for record in records)
    readable: list[str] = []
    corrupt: list[dict[str, str]] = []
    dimensions: Counter[str] = Counter()
    content_hashes: dict[str, list[str]] = defaultdict(list)
    perceptual_hashes: dict[str, int] = {}

    for record in image_records:
        path = resolve_path(root, record.relative_path)
        try:
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                dimensions[f"{image.width}x{image.height}"] += 1
            readable.append(record.relative_path)
            content_hashes[sha256_file(path)].append(record.relative_path)
            if record.task == "classification":
                perceptual_hashes[record.relative_path] = dhash64(path)
        except (FileNotFoundError, OSError, UnidentifiedImageError) as exc:
            corrupt.append({"relative_path": record.relative_path, "error": str(exc)})

    missing_linked_images = [record.relative_path for record in mask_records if record.linked_image and record.linked_image not in path_set]
    missing_mask_files = [record.relative_path for record in mask_records if not resolve_path(root, record.relative_path).exists()]
    image_mask_dimension_mismatches: list[dict[str, object]] = []
    for mask in mask_records:
        if not mask.linked_image or mask.linked_image not in image_by_relative:
            continue
        try:
            with Image.open(resolve_path(root, mask.relative_path)) as mask_image, Image.open(resolve_path(root, mask.linked_image)) as image:
                if mask_image.size != image.size:
                    image_mask_dimension_mismatches.append({"mask": mask.relative_path, "image": mask.linked_image, "mask_size": mask_image.size, "image_size": image.size})
        except (FileNotFoundError, OSError, UnidentifiedImageError) as exc:
            corrupt.append({"relative_path": mask.relative_path, "error": str(exc)})

    exact_groups = [paths for paths in content_hashes.values() if len(paths) > 1]
    classification_exact_groups = [[path for path in paths if image_by_relative[path].task == "classification"] for paths in exact_groups]
    classification_exact_groups = [paths for paths in classification_exact_groups if len(paths) > 1]
    classification_cross_split_groups, classification_train_exclusions = task_cross_split_groups(
        exact_groups, image_by_relative, "classification"
    )
    segmentation_cross_split_groups, segmentation_train_exclusions = task_cross_split_groups(
        exact_groups, image_by_relative, "segmentation"
    )
    review_pairs = find_review_pairs(perceptual_hashes)
    cross_split_review_pairs = [
        pair
        for pair in review_pairs
        if image_by_relative[pair["left"]].split != image_by_relative[pair["right"]].split
    ]
    strict_review_pairs = []
    for pair in review_pairs:
        similarity = image_similarity(resolve_path(root, pair["left"]), resolve_path(root, pair["right"]))
        if similarity["correlation"] >= 0.995 and similarity["normalized_mae"] <= 0.03:
            strict_review_pairs.append({**pair, **similarity})
    strict_cross_split_review_pairs = [
        pair
        for pair in strict_review_pairs
        if image_by_relative[pair["left"]].split != image_by_relative[pair["right"]].split
    ]
    strict_cross_split_train_exclusions = sorted(
        {
            path
            for pair in strict_cross_split_review_pairs
            for path in (pair["left"], pair["right"])
            if image_by_relative[path].split == "train"
        }
    )

    summary: dict[str, object] = {
        "dataset_root": str(root),
        "manifest_records": len(records),
        "task_counts": dict(sorted(task_counts.items())),
        "image_records": len(image_records),
        "mask_records": len(mask_records),
        "readable_images": len(readable),
        "corrupt_or_missing_records": corrupt,
        "classification_class_counts": {f"{split}:{label}": count for (split, label), count in sorted(class_counts.items())},
        "dimensions": dict(dimensions.most_common()),
        "manifest_checksums": {
            "manifest.csv": manifest_checksum_status(root, "manifest.csv"),
            "manifest.json": manifest_checksum_status(root, "manifest.json"),
        },
        "missing_linked_images": missing_linked_images,
        "missing_mask_files": missing_mask_files,
        "image_mask_dimension_mismatches": image_mask_dimension_mismatches,
        "exact_duplicate_group_count_all_tasks": len(exact_groups),
        "classification_exact_duplicate_group_count": len(classification_exact_groups),
        "classification_exact_cross_split_duplicate_group_count": len(classification_cross_split_groups),
        "classification_exact_cross_split_train_exclusion_count": len(classification_train_exclusions),
        "classification_exact_cross_split_duplicate_examples": classification_cross_split_groups[:10],
        "segmentation_exact_cross_split_duplicate_group_count": len(segmentation_cross_split_groups),
        "segmentation_exact_cross_split_train_exclusion_count": len(segmentation_train_exclusions),
        "segmentation_exact_cross_split_duplicate_examples": segmentation_cross_split_groups[:10],
        "dhash_review_pair_count": len(review_pairs),
        "dhash_cross_split_review_pair_count": len(cross_split_review_pairs),
        "dhash_cross_split_review_examples": cross_split_review_pairs[:10],
        "strict_review_pair_count": len(strict_review_pairs),
        "strict_cross_split_review_pair_count": len(strict_cross_split_review_pairs),
        "strict_cross_split_train_exclusion_count": len(strict_cross_split_train_exclusions),
        "strict_cross_split_review_examples": strict_cross_split_review_pairs[:10],
        "limitations": [
            "The release is 2D single-slice contrast-enhanced T1 MRI, not full-volume clinical MRI.",
            "The source publication states that subject-level independence cannot be guaranteed because original patient and sequence identifiers are unavailable.",
            "dHash pairs are review candidates only; they must not be treated as confirmed duplicates without visual review.",
        ],
    }
    (output_dir / "audit_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    (output_dir / "exact_duplicate_groups_all_tasks.json").write_text(json.dumps(exact_groups, indent=2), encoding="utf-8")
    (output_dir / "classification_exact_cross_split_groups.json").write_text(json.dumps(classification_cross_split_groups, indent=2), encoding="utf-8")
    (output_dir / "classification_exact_cross_split_train_exclusions.json").write_text(json.dumps(classification_train_exclusions, indent=2), encoding="utf-8")
    (output_dir / "segmentation_exact_cross_split_groups.json").write_text(json.dumps(segmentation_cross_split_groups, indent=2), encoding="utf-8")
    (output_dir / "segmentation_exact_cross_split_train_exclusions.json").write_text(json.dumps(segmentation_train_exclusions, indent=2), encoding="utf-8")
    (output_dir / "dhash_review_pairs.json").write_text(json.dumps(review_pairs, indent=2), encoding="utf-8")
    (output_dir / "strict_review_pairs.json").write_text(json.dumps(strict_review_pairs, indent=2), encoding="utf-8")
    (output_dir / "strict_cross_split_train_exclusions.json").write_text(json.dumps(strict_cross_split_train_exclusions, indent=2), encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(audit(args.dataset_root, args.output_dir), indent=2))


if __name__ == "__main__":
    main()
