#!/usr/bin/env python3
"""Create a reproducible integrity audit for a four-class 2D MRI image directory."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path

from PIL import Image, UnidentifiedImageError

VALID_EXTENSIONS = {".png", ".jpg", ".jpeg"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1_048_576), b""):
            digest.update(chunk)
    return digest.hexdigest()


def dhash(image: Image.Image) -> str:
    grayscale = image.convert("L").resize((9, 8))
    pixels = list(grayscale.getdata())
    bits = [pixels[row * 9 + column] > pixels[row * 9 + column + 1] for row in range(8) for column in range(8)]
    return f"{sum(1 << index for index, bit in enumerate(bits) if bit):016x}"


def hamming(left: str, right: str) -> int:
    return (int(left, 16) ^ int(right, 16)).bit_count()


def infer_split_and_class(root: Path, path: Path) -> tuple[str, str]:
    relative = path.relative_to(root)
    parts = relative.parts
    if len(parts) >= 2 and parts[0].lower() in {"train", "training", "test", "testing", "val", "validation"}:
        return parts[0].lower(), parts[1].lower()
    return "unassigned", parts[0].lower() if parts else "unknown"


def collect(root: Path) -> tuple[list[dict[str, object]], list[dict[str, str]]]:
    rows: list[dict[str, object]] = []
    issues: list[dict[str, str]] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in VALID_EXTENSIONS:
            continue
        split, label = infer_split_and_class(root, path)
        base = {"file_path": str(path.relative_to(root)), "split": split, "label": label, "source": root.name, "patient_id": "", "mask_available": "false"}
        try:
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                record = {**base, "width": image.width, "height": image.height, "mode": image.mode, "format": image.format, "sha256": sha256(path), "dhash": dhash(image)}
        except (UnidentifiedImageError, OSError) as error:
            issues.append({"file_path": str(path.relative_to(root)), "issue": "corrupted_or_unsupported", "detail": str(error)})
            continue
        rows.append(record)
    return rows, issues


def duplicate_report(rows: list[dict[str, object]], threshold: int) -> dict[str, object]:
    exact: dict[str, list[str]] = defaultdict(list)
    buckets: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        exact[str(row["sha256"])].append(str(row["file_path"]))
        buckets[str(row["dhash"])[:4]].append(row)
    exact_groups = [paths for paths in exact.values() if len(paths) > 1]
    near_pairs: list[dict[str, object]] = []
    for bucket in buckets.values():
        for index, left in enumerate(bucket):
            for right in bucket[index + 1 :]:
                distance = hamming(str(left["dhash"]), str(right["dhash"]))
                if distance <= threshold:
                    near_pairs.append({"left": left["file_path"], "right": right["file_path"], "hamming_distance": distance})
    return {"exact_duplicate_groups": exact_groups, "near_duplicate_pairs_within_hash_prefix_buckets": near_pairs, "near_duplicate_threshold": threshold, "method_limit": "Near-duplicate candidates are compared within dHash prefix buckets for bounded runtime; review this conservative candidate list manually."}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--near-duplicate-threshold", type=int, default=5)
    args = parser.parse_args()
    if not args.input.is_dir():
        raise SystemExit(f"Input directory does not exist: {args.input}")
    args.output.mkdir(parents=True, exist_ok=True)
    rows, issues = collect(args.input)
    columns = ["file_path", "split", "label", "source", "patient_id", "mask_available", "width", "height", "mode", "format", "sha256", "dhash"]
    with (args.output / "classification_manifest.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        writer.writeheader(); writer.writerows(rows)
    counts = Counter((str(row["split"]), str(row["label"])) for row in rows)
    report = {"created_at": datetime.now(UTC).isoformat(), "input": str(args.input.resolve()), "image_count": len(rows), "corrupted_or_unsupported_count": len(issues), "class_distribution": [{"split": split, "label": label, "count": count} for (split, label), count in sorted(counts.items())], "duplicate_report": duplicate_report(rows, args.near_duplicate_threshold), "limitations": ["Patient identifiers are not inferred from folder names. Add verified patient identifiers before patient-level splitting.", "This script audits image-level integrity; it does not validate clinical labels or source provenance."]}
    (args.output / "classification_audit.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (args.output / "classification_issues.json").write_text(json.dumps(issues, indent=2), encoding="utf-8")
    print(json.dumps({"manifest": str(args.output / "classification_manifest.csv"), "report": str(args.output / "classification_audit.json"), "images": len(rows), "issues": len(issues)}))


if __name__ == "__main__":
    main()

