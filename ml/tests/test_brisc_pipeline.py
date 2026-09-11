import csv
import hashlib
import json
from pathlib import Path
from subprocess import run

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _write_manifest(root: Path, rows: list[dict[str, str]]) -> None:
    fields = ["relative_path", "task", "split", "tumor_label", "is_mask", "linked_image"]
    with (root / "manifest.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    (root / "manifest.json").write_text("{}", encoding="utf-8")
    for name in ("manifest.csv", "manifest.json"):
        (root / f"{name}.sha256").write_text(f"{_sha256(root / name)}  {name}\n", encoding="utf-8")


def test_brisc_audit_normalizes_windows_paths_and_reports_cross_split_duplicate(tmp_path: Path):
    root = tmp_path / "brisc2025"
    train = root / "classification_task" / "train" / "glioma"
    test = root / "classification_task" / "test" / "glioma"
    train.mkdir(parents=True)
    test.mkdir(parents=True)
    image = Image.new("L", (12, 12), color=110)
    image.save(train / "train.jpg")
    image.save(test / "test.jpg")
    _write_manifest(
        root,
        [
            {"relative_path": "classification_task\\train\\glioma\\train.jpg", "task": "classification", "split": "train", "tumor_label": "glioma", "is_mask": "false", "linked_image": ""},
            {"relative_path": "classification_task\\test\\glioma\\test.jpg", "task": "classification", "split": "test", "tumor_label": "glioma", "is_mask": "false", "linked_image": ""},
        ],
    )
    output = tmp_path / "audit"
    result = run(
        ["python3", str(ROOT / "ml" / "audit_brisc.py"), "--dataset-root", str(root), "--output-dir", str(output)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    summary = json.loads((output / "audit_summary.json").read_text(encoding="utf-8"))
    assert summary["readable_images"] == 2
    assert summary["manifest_checksums"]["manifest.csv"]["status"] == "passed"
    assert summary["classification_exact_cross_split_duplicate_group_count"] == 1
    assert summary["classification_exact_cross_split_train_exclusion_count"] == 1


def test_brisc_split_builder_excludes_cross_split_records_and_keeps_test_untouched(tmp_path: Path):
    root = tmp_path / "brisc2025"
    root.mkdir()
    rows = [
        {"relative_path": "classification_task/train/glioma/leak.jpg", "task": "classification", "split": "train", "tumor_label": "glioma", "is_mask": "false", "linked_image": ""},
        {"relative_path": "classification_task/train/glioma/clean.jpg", "task": "classification", "split": "train", "tumor_label": "glioma", "is_mask": "false", "linked_image": ""},
        {"relative_path": "classification_task/test/glioma/test.jpg", "task": "classification", "split": "test", "tumor_label": "glioma", "is_mask": "false", "linked_image": ""},
        {"relative_path": "segmentation_task/train/images/clean.jpg", "task": "segmentation", "split": "train", "tumor_label": "glioma", "is_mask": "false", "linked_image": ""},
        {"relative_path": "segmentation_task/test/images/test.jpg", "task": "segmentation", "split": "test", "tumor_label": "glioma", "is_mask": "false", "linked_image": ""},
    ]
    _write_manifest(root, rows)
    audit_dir = tmp_path / "audit"
    audit_dir.mkdir()
    (audit_dir / "strict_review_pairs.json").write_text("[]", encoding="utf-8")
    (audit_dir / "classification_exact_cross_split_train_exclusions.json").write_text(json.dumps(["classification_task/train/glioma/leak.jpg"]), encoding="utf-8")
    (audit_dir / "strict_cross_split_train_exclusions.json").write_text("[]", encoding="utf-8")
    output = tmp_path / "splits"
    result = run(
        ["python3", str(ROOT / "ml" / "build_brisc_splits.py"), "--dataset-root", str(root), "--audit-dir", str(audit_dir), "--output-dir", str(output)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    summary = json.loads((output / "split_summary.json").read_text(encoding="utf-8"))
    assert summary["excluded_cross_split_train"] == 1
    assert summary["official_classification_test_untouched"] == 1
    assert summary["sanitized_classification_train"] + summary["sanitized_classification_validation"] == 1
