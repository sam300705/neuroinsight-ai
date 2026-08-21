#!/usr/bin/env python3
"""Audit NIfTI volumes and produce a non-identifying manifest for segmentation experiments."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from datetime import UTC, datetime
from pathlib import Path

import nibabel as nib


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1_048_576), b""):
            digest.update(chunk)
    return digest.hexdigest()


def case_id(root: Path, path: Path) -> str:
    name = path.name.removesuffix(".nii.gz").removesuffix(".nii")
    return re.sub(r"_\d{4}$", "", name)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    rows, issues = [], []
    files = sorted(path for path in list(args.input.rglob("*.nii")) + list(args.input.rglob("*.nii.gz")) if not path.name.startswith("._"))
    label_case_ids = {case_id(args.input, path) for path in files if any("label" in part.lower() for part in path.relative_to(args.input).parts)}
    for path in files:
        try:
            image = nib.load(str(path))
            shape = image.shape
            spacing = tuple(float(item) for item in image.header.get_zooms()[:3])
            if len(shape) < 3 or any(item <= 0 for item in spacing):
                raise ValueError("Expected a three-dimensional volume with positive voxel spacing")
            relative = path.relative_to(args.input)
            current_case_id = case_id(args.input, path)
            is_label = any("label" in part.lower() for part in relative.parts)
            rows.append({"file_path": str(relative), "case_id": current_case_id, "shape": "x".join(map(str, shape)), "spacing_mm": "x".join(map(str, spacing)), "dtype": str(image.get_data_dtype()), "orientation": "".join(nib.aff2axcodes(image.affine)), "mask_available": current_case_id in label_case_ids, "is_label": is_label, "sha256": file_sha256(path)})
        except Exception as error:
            issues.append({"file_path": str(path.relative_to(args.input)), "issue": "corrupted_or_incompatible_nifti", "detail": str(error)})
    columns = ["file_path", "case_id", "shape", "spacing_mm", "dtype", "orientation", "mask_available", "is_label", "sha256"]
    with (args.output / "nifti_manifest.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=columns); writer.writeheader(); writer.writerows(rows)
    report = {"created_at": datetime.now(UTC).isoformat(), "volume_count": len(rows), "issue_count": len(issues), "unique_case_count": len({row["case_id"] for row in rows}), "limitations": ["Sequence/modality naming needs source-specific mapping before model training.", "A case-level split must be constructed from the case_id field, not from individual volumes or slices."]}
    (args.output / "nifti_audit.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (args.output / "nifti_issues.json").write_text(json.dumps(issues, indent=2), encoding="utf-8")
    print(json.dumps({"manifest": str(args.output / "nifti_manifest.csv"), "report": str(args.output / "nifti_audit.json"), "volumes": len(rows), "issues": len(issues)}))


if __name__ == "__main__":
    main()
