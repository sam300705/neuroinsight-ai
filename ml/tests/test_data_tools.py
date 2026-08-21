from pathlib import Path
from subprocess import run

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]


def test_classification_audit_reports_exact_duplicate(tmp_path: Path):
    dataset = tmp_path / "dataset" / "train" / "glioma"
    dataset.mkdir(parents=True)
    image = Image.new("L", (8, 8), color=100)
    image.save(dataset / "one.png")
    image.save(dataset / "two.png")
    output = tmp_path / "audit"
    result = run(["python3", str(ROOT / "scripts/audit_classification_dataset.py"), "--input", str(tmp_path / "dataset"), "--output", str(output)], capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr
    assert (output / "classification_manifest.csv").exists()
    assert '"image_count": 2' in (output / "classification_audit.json").read_text()
    assert "one.png" in (output / "classification_audit.json").read_text()


def test_group_split_refuses_missing_patient_ids(tmp_path: Path):
    manifest = tmp_path / "manifest.csv"
    manifest.write_text("file_path,patient_id\nscan.png,\n", encoding="utf-8")
    result = run(["python3", str(ROOT / "scripts/split_manifest.py"), "--input", str(manifest), "--output", str(tmp_path / "split.csv")], capture_output=True, text=True, check=False)
    assert result.returncode != 0
    assert "empty patient_id" in result.stderr


def test_deduplicated_split_keeps_exact_hashes_together(tmp_path: Path):
    manifest = tmp_path / "manifest.csv"
    manifest.write_text(
        "file_path,label,sha256\na.png,glioma,same\nb.png,glioma,same\nc.png,glioma,different\n",
        encoding="utf-8",
    )
    output = tmp_path / "split.csv"
    result = run(
        ["python3", str(ROOT / "scripts/prepare_deduplicated_classification.py"), "--manifest", str(manifest), "--output", str(output)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    rows = output.read_text(encoding="utf-8").splitlines()
    assert rows[1].split(",")[-3] == rows[2].split(",")[-3]
    assert '"patient_level_split": false' in output.with_suffix(".metadata.json").read_text(encoding="utf-8")
