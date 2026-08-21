#!/usr/bin/env python3
"""Summarize an audit JSON file without copying raw image-level records into the repository."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = json.loads(args.input.read_text(encoding="utf-8"))
    groups = report["duplicate_report"]["exact_duplicate_groups"]
    cross_partition = [group for group in groups if len({path.split("/", 1)[0].lower() for path in group}) > 1]
    summary = {
        "image_count": report["image_count"],
        "corrupted_or_unsupported_count": report["corrupted_or_unsupported_count"],
        "class_distribution": report["class_distribution"],
        "exact_duplicate_group_count": len(groups),
        "exact_duplicate_image_occurrences": sum(len(group) for group in groups),
        "cross_partition_exact_duplicate_group_count": len(cross_partition),
        "cross_partition_exact_duplicate_image_occurrences": sum(len(group) for group in cross_partition),
        "near_duplicate_candidate_pair_count": len(report["duplicate_report"]["near_duplicate_pairs_within_hash_prefix_buckets"]),
        "decision": "The supplied train/test split is not valid for held-out evaluation when exact duplicates cross partitions. Create a deduplicated development set only; do not report conventional held-out test metrics from this supplied split.",
    }
    rendered = json.dumps(summary, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()

