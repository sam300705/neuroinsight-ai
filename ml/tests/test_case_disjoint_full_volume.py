import csv
import json
from pathlib import Path
from subprocess import run


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "build_case_disjoint_full_volume_manifest.py"


def write_manifest(path: Path, cases: list[str], include_label: bool = True) -> None:
    rows = []
    for case in cases:
        rows.append({"file_path": f"imagesTr/{case}_0000.nii.gz", "case_id": case, "mask_available": "True", "is_label": "False"})
        if include_label:
            rows.append({"file_path": f"labelsTr/{case}.nii.gz", "case_id": case, "mask_available": "True", "is_label": "True"})
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)


def test_builds_case_disjoint_full_volume_development_manifest(tmp_path: Path):
    source, output = tmp_path / "audit.csv", tmp_path / "full_volume.csv"
    write_manifest(source, ["CASE_A", "CASE_B", "CASE_C", "CASE_D"])
    result = run(["python3", str(SCRIPT), "--manifest", str(source), "--output", str(output), "--seed", "7"], capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr
    with output.open(newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))
    split_by_case = {}
    for row in rows:
        split_by_case.setdefault(row["case_id"], set()).add(row["split"])
    assert all(len(splits) == 1 for splits in split_by_case.values())
    assert set().union(*split_by_case.values()) == {"train", "validation"}
    metadata = json.loads(output.with_suffix(".metadata.json").read_text(encoding="utf-8"))
    assert metadata["evaluation_unit"] == "case-disjoint full-volume development split"
    assert "separately sourced" in metadata["hidden_test_requirement"]


def test_refuses_incomplete_full_volume_cases(tmp_path: Path):
    source, output = tmp_path / "audit.csv", tmp_path / "full_volume.csv"
    write_manifest(source, ["CASE_A", "CASE_B"], include_label=False)
    result = run(["python3", str(SCRIPT), "--manifest", str(source), "--output", str(output)], capture_output=True, text=True, check=False)
    assert result.returncode != 0
    assert "complete image-plus-one-label cases" in result.stderr
