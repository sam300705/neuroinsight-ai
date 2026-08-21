#!/usr/bin/env python3
"""Create a deterministic image-level development split grouped by exact duplicate hash.

This is not a patient-level split. It is a leakage-reduction fallback for datasets
whose records do not provide patient identifiers, and its resulting metrics must
be labelled accordingly.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
from collections import Counter, defaultdict
from pathlib import Path


def seed_for(label: str, value: str, seed: str) -> int:
    return int(hashlib.sha256(f"{seed}:{label}:{value}".encode()).hexdigest()[:16], 16)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seed", default="neuroinsight-mendeley-v1")
    parser.add_argument("--train", type=float, default=0.70)
    parser.add_argument("--validation", type=float, default=0.15)
    args = parser.parse_args()
    if args.train <= 0 or args.validation <= 0 or args.train + args.validation >= 1:
        raise SystemExit("train and validation fractions must be positive and sum to less than one")
    with args.manifest.open(newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))
        columns = list(rows[0].keys()) if rows else []
    grouped: dict[str, dict[str, list[dict[str, str]]]] = defaultdict(lambda: defaultdict(list))
    for row in rows:
        grouped[row["label"]][row["sha256"]].append(row)
    assignments: dict[str, str] = {}
    for label, hashes in grouped.items():
        unique_hashes = list(hashes)
        random.Random(seed_for(label, "shuffle", args.seed)).shuffle(unique_hashes)
        train_cutoff = round(len(unique_hashes) * args.train)
        validation_cutoff = train_cutoff + round(len(unique_hashes) * args.validation)
        for index, image_hash in enumerate(unique_hashes):
            assignments[image_hash] = "train" if index < train_cutoff else "validation" if index < validation_cutoff else "test"
    for row in rows:
        row["audit_split"] = assignments[row["sha256"]]
        row["split_unit"] = "exact_image_hash_group"
        row["patient_level_split"] = "false"
    output_columns = columns + ["audit_split", "split_unit", "patient_level_split"]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=output_columns)
        writer.writeheader(); writer.writerows(rows)
    distribution = Counter((row["audit_split"], row["label"]) for row in rows)
    metadata = {"seed": args.seed, "source_manifest": str(args.manifest), "split_unit": "exact_image_hash_group", "patient_level_split": False, "warning": "This fallback prevents exact image duplication across partitions but cannot prevent slice/patient leakage because patient identifiers are unavailable.", "counts": [{"split": split, "label": label, "count": count} for (split, label), count in sorted(distribution.items())]}
    args.output.with_suffix(".metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()

