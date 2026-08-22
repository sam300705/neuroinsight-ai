"""Build conservative BRISC research manifests from an authorised local data release.

The official test split is never used for model selection. Training records that are exact or
strictly similar to official-test images are excluded. Strictly similar remaining training
records are grouped before deterministic class-stratified validation allocation.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path


class UnionFind:
    def __init__(self, values: list[str]):
        self.parent = {value: value for value in values}

    def find(self, value: str) -> str:
        if self.parent[value] != value:
            self.parent[value] = self.find(self.parent[value])
        return self.parent[value]

    def union(self, left: str, right: str) -> None:
        root_left, root_right = self.find(left), self.find(right)
        if root_left != root_right:
            self.parent[root_right] = root_left


def normalized(value: str) -> str:
    return value.strip().replace("\\", "/")


def read_rows(manifest_path: Path) -> tuple[list[dict[str, str]], list[str]]:
    with manifest_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        return list(reader), reader.fieldnames or []


def write_rows(path: Path, rows: list[dict[str, str]], fields: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def stable_order_key(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def group_rows(train_rows: list[dict[str, str]], strict_pairs: list[dict[str, object]]) -> tuple[list[list[dict[str, str]]], list[dict[str, str]]]:
    row_by_path = {normalized(row["relative_path"]): row for row in train_rows}
    union_find = UnionFind(list(row_by_path))
    for pair in strict_pairs:
        left, right = normalized(str(pair["left"])), normalized(str(pair["right"]))
        if left in row_by_path and right in row_by_path:
            union_find.union(left, right)
    groups: dict[str, list[dict[str, str]]] = defaultdict(list)
    for path, row in row_by_path.items():
        groups[union_find.find(path)].append(row)

    usable, excluded_mixed_label = [], []
    for members in groups.values():
        labels = {row["tumor_label"].strip().lower() for row in members}
        if len(labels) == 1:
            usable.append(sorted(members, key=lambda row: normalized(row["relative_path"])))
        else:
            excluded_mixed_label.extend(members)
    return usable, excluded_mixed_label


def allocate_validation(groups: list[list[dict[str, str]]], fraction: float) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    by_label: dict[str, list[list[dict[str, str]]]] = defaultdict(list)
    for group in groups:
        by_label[group[0]["tumor_label"].strip().lower()].append(group)

    train, validation = [], []
    for label, label_groups in sorted(by_label.items()):
        target = max(1, round(sum(len(group) for group in label_groups) * fraction))
        selected = 0
        for group in sorted(label_groups, key=lambda group: stable_order_key(normalized(group[0]["relative_path"]))):
            if selected < target:
                validation.extend(group)
                selected += len(group)
            else:
                train.extend(group)
    return train, validation


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--audit-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--validation-fraction", type=float, default=0.15)
    args = parser.parse_args()

    rows, fields = read_rows(args.dataset_root / "manifest.csv")
    strict_pairs = json.loads((args.audit_dir / "strict_review_pairs.json").read_text(encoding="utf-8"))
    exact_exclusions = set(json.loads((args.audit_dir / "classification_exact_cross_split_train_exclusions.json").read_text(encoding="utf-8")))
    strict_exclusions = set(json.loads((args.audit_dir / "strict_cross_split_train_exclusions.json").read_text(encoding="utf-8")))
    exclusions = {normalized(path) for path in exact_exclusions | strict_exclusions}

    classification_rows = [row for row in rows if row["task"].strip().lower() == "classification" and row["is_mask"].strip().lower() != "true"]
    official_train = [row for row in classification_rows if row["split"].strip().lower() == "train"]
    official_test = [row for row in classification_rows if row["split"].strip().lower() == "test"]
    candidate_train = [row for row in official_train if normalized(row["relative_path"]) not in exclusions]
    groups, mixed_label_exclusions = group_rows(candidate_train, strict_pairs)
    train_rows, validation_rows = allocate_validation(groups, args.validation_fraction)

    segmentation_rows = [row for row in rows if row["task"].strip().lower() == "segmentation" and row["is_mask"].strip().lower() != "true"]
    classification_assignment = {
        Path(normalized(row["relative_path"])).name: "train" for row in train_rows
    } | {
        Path(normalized(row["relative_path"])).name: "validation" for row in validation_rows
    } | {
        Path(normalized(row["relative_path"])).name: "test" for row in official_test
    }
    segmentation_train = []
    segmentation_validation = []
    segmentation_test = []
    segmentation_unassigned = []
    for row in segmentation_rows:
        bucket = classification_assignment.get(Path(normalized(row["relative_path"])).name)
        if bucket == "train":
            segmentation_train.append(row)
        elif bucket == "validation":
            segmentation_validation.append(row)
        elif bucket == "test":
            segmentation_test.append(row)
        else:
            segmentation_unassigned.append(row)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    for name, selected_rows in {
        "classification_train.csv": train_rows,
        "classification_validation.csv": validation_rows,
        "classification_official_test.csv": official_test,
        "classification_excluded_cross_split.csv": [row for row in official_train if normalized(row["relative_path"]) in exclusions],
        "classification_excluded_mixed_label_similarity.csv": mixed_label_exclusions,
        "segmentation_train.csv": segmentation_train,
        "segmentation_validation.csv": segmentation_validation,
        "segmentation_official_test.csv": segmentation_test,
        "segmentation_unassigned.csv": segmentation_unassigned,
    }.items():
        write_rows(args.output_dir / name, selected_rows, fields)

    summary = {
        "official_classification_train": len(official_train),
        "official_classification_test": len(official_test),
        "excluded_cross_split_train": len(official_train) - len(candidate_train),
        "excluded_mixed_label_similarity": len(mixed_label_exclusions),
        "sanitized_classification_train": len(train_rows),
        "sanitized_classification_validation": len(validation_rows),
        "official_classification_test_untouched": len(official_test),
        "classification_train_by_label": dict(Counter(row["tumor_label"].strip().lower() for row in train_rows)),
        "classification_validation_by_label": dict(Counter(row["tumor_label"].strip().lower() for row in validation_rows)),
        "classification_test_by_label": dict(Counter(row["tumor_label"].strip().lower() for row in official_test)),
        "segmentation_train": len(segmentation_train),
        "segmentation_validation": len(segmentation_validation),
        "segmentation_official_test": len(segmentation_test),
        "segmentation_unassigned": len(segmentation_unassigned),
        "limitations": [
            "The published source lacks patient identifiers; these are image-level research splits, not patient-independent validation.",
            "The official test partition remains untouched for final evaluation and is not used for model selection.",
            "Strictly similar cross-split training candidates are excluded conservatively; remaining similarity candidates require documented limitations.",
        ],
    }
    (args.output_dir / "split_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
