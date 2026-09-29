#!/usr/bin/env python3
"""Build case-disjoint full-volume development manifests from an audited NIfTI manifest.

This utility deliberately prepares data only. It neither trains nor exports a model, and it
requires a complete image-plus-label case before assigning that case to development. A hidden
test cohort must be supplied independently; it is never created by slicing a training case.
"""

from __future__ import annotations

import argparse
import csv
import json
import random
from collections import defaultdict
from pathlib import Path


def is_true(value: str | None) -> bool:
    return str(value).strip().lower() == "true"


def load_complete_cases(manifest: Path) -> dict[str, list[dict[str, str]]]:
    with manifest.open(newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))
    required = {"file_path", "case_id", "mask_available", "is_label"}
    missing = required.difference(rows[0].keys() if rows else set())
    if missing:
        raise ValueError(f"Manifest is missing required columns: {', '.join(sorted(missing))}")
    cases: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        case = row["case_id"].strip()
        if not case:
            raise ValueError("Manifest contains an empty case_id; case-disjoint splitting cannot continue.")
        cases[case].append(row)
    incomplete: list[str] = []
    for case, case_rows in cases.items():
        images = [row for row in case_rows if not is_true(row.get("is_label"))]
        labels = [row for row in case_rows if is_true(row.get("is_label"))]
        if not images or len(labels) != 1 or not all(is_true(row.get("mask_available")) for row in case_rows):
            incomplete.append(case)
    if incomplete:
        raise ValueError(f"Full-volume preparation requires complete image-plus-one-label cases; incomplete: {', '.join(sorted(incomplete))}")
    return dict(cases)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--validation-fraction", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=20260823)
    args = parser.parse_args()
    if not 0 < args.validation_fraction < 1:
        raise SystemExit("--validation-fraction must be between 0 and 1.")
    cases = load_complete_cases(args.manifest)
    case_ids = sorted(cases)
    if len(case_ids) < 2:
        raise SystemExit("At least two complete cases are required for case-disjoint development splitting.")
    random.Random(args.seed).shuffle(case_ids)
    validation_count = min(max(1, round(len(case_ids) * args.validation_fraction)), len(case_ids) - 1)
    validation_cases = set(case_ids[:validation_count])
    output_rows = []
    for case_id in sorted(cases):
        split = "validation" if case_id in validation_cases else "train"
        for row in cases[case_id]:
            output_rows.append({**row, "split": split})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    columns = [*output_rows[0].keys()]
    with args.output.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        writer.writeheader()
        writer.writerows(output_rows)
    metadata = {
        "evaluation_unit": "case-disjoint full-volume development split",
        "seed": args.seed,
        "train_case_ids": sorted(set(case_ids).difference(validation_cases)),
        "validation_case_ids": sorted(validation_cases),
        "hidden_test_requirement": "A separately sourced, pre-specified case-level test cohort is required before any held-out evaluation or model-promotion decision.",
        "limitations": [
            "This utility prepares full-volume case manifests only; it does not train, evaluate, calibrate, export, or activate a model.",
            "Case identifiers must be provenance-backed source identifiers, not inferred from individual slices.",
            "No Mode B dashboard activation is permitted without an approved full-volume model, case-disjoint held-out evaluation, uncertainty policy, and artifact verification.",
        ],
    }
    args.output.with_suffix(".metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(args.output), "train_cases": len(metadata["train_case_ids"]), "validation_cases": len(metadata["validation_case_ids"])}))


if __name__ == "__main__":
    main()
