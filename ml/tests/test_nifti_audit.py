import csv
from pathlib import Path
from subprocess import run

import nibabel as nib
import numpy as np


ROOT = Path(__file__).resolve().parents[2]


def test_nifti_audit_groups_modalities_and_finds_matching_label(tmp_path: Path):
    root = tmp_path / "Task01"
    (root / "imagesTr").mkdir(parents=True)
    (root / "labelsTr").mkdir()
    image = nib.Nifti1Image(np.zeros((3, 3, 3), dtype=np.float32), np.eye(4))
    nib.save(image, root / "imagesTr" / "BRATS_001_0000.nii.gz")
    nib.save(image, root / "imagesTr" / "BRATS_001_0001.nii.gz")
    nib.save(image, root / "labelsTr" / "BRATS_001.nii.gz")
    (root / "imagesTr" / "._BRATS_001_0000.nii.gz").write_bytes(b"AppleDouble metadata")
    output = tmp_path / "audit"
    result = run(["python3", str(ROOT / "scripts/audit_nifti_dataset.py"), "--input", str(root), "--output", str(output)], capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr
    with (output / "nifti_manifest.csv").open(newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))
    assert {row["case_id"] for row in rows} == {"BRATS_001"}
    assert all(row["mask_available"] == "True" for row in rows)
    assert len(rows) == 3
