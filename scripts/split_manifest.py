#!/usr/bin/env python3
"""Assign deterministic group-level train/validation/test labels without slice leakage."""

from __future__ import annotations

import argparse
import csv
import hashlib
from collections import defaultdict
from pathlib import Path


def group_bucket(group: str, seed: str) -> int:
    return int(hashlib.sha256(f"{seed}:{group}".encode()).hexdigest()[:8], 16) % 10_000


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--group-column", default="patient_id")
    parser.add_argument("--seed", default="neuroinsight-2026")
    parser.add_argument("--train", type=float, default=0.7)
    parser.add_argument("--validation", type=float, default=0.15)
    args = parser.parse_args()
    if not 0 < args.train < 1 or not 0 < args.validation < 1 or args.train + args.validation >= 1:
        raise SystemExit("train and validation fractions must be positive and sum to less than one")
    with args.input.open(newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))
        columns = list(rows[0].keys()) if rows else []
    if args.group_column not in columns:
        raise SystemExit(f"Missing group column: {args.group_column}")
    missing = [row["file_path"] for row in rows if not row.get(args.group_column)]
    if missing:
        raise SystemExit(f"Cannot create patient-level split: {len(missing)} rows have empty {args.group_column}")
    groups = defaultdict(list)
    for row in rows: groups[row[args.group_column]].append(row)
    train_cutoff, validation_cutoff = int(args.train * 10_000), int((args.train + args.validation) * 10_000)
    for group, group_rows in groups.items():
        bucket = group_bucket(group, args.seed)
        split = "train" if bucket < train_cutoff else "validation" if bucket < validation_cutoff else "test"
        for row in group_rows: row["split"] = split
    if "split" not in columns: columns.append("split")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=columns); writer.writeheader(); writer.writerows(rows)
    print(f"Wrote {len(rows)} rows from {len(groups)} groups to {args.output}")


if __name__ == "__main__":
    main()

