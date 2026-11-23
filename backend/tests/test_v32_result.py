import base64
from pathlib import Path

from neuroinsight_api.v32_runtime import MODEL_VERSION, load_pipeline

from test_app import app, client, png_bytes


def test_missing_model_files_fail_before_initialization(tmp_path: Path):
    import pytest

    with pytest.raises(FileNotFoundError):
        load_pipeline(tmp_path / "models")


def test_disagreement_keeps_class_confidence_separate_and_binds_only_the_mask(monkeypatch):
    encoded_mask = base64.b64encode(png_bytes()).decode()
    encoded_overlay = base64.b64encode(png_bytes() + b"test overlay trailer").decode()

    class DisagreementWorker:
        def predict(self, _payload):
            return {
                "class": "no_tumor",
                "confidence": 0.97,
                "final_label": "possible_tumor (type unclear)",
                "tumor_detected": True,
                "needs_review": True,
                "review_reasons": ["classifier: no_tumor, but segmentation found a tumor region"],
                "mask_uncertain": True,
                "mask_notes": ["segmentation ensemble uncertain"],
                "image": {"width": 128, "height": 128},
                "bbox": {"x_min": 16, "y_min": 8, "x_max": 111, "y_max": 119},
                "tumor_area_px": 8200,
                "tumor_pct_of_image": 50.05,
                "tumor_pct_of_brain": 76.0,
                "mask_png_base64": encoded_mask,
                "overlay_png_base64": encoded_overlay,
                "gradcam_png_base64": None,
            }

    monkeypatch.setattr(app.state, "classifier", DisagreementWorker(), raising=False)
    monkeypatch.setenv("ANALYSIS_RECEIPT_SECRET", "test-secret-for-v32-mask-integrity-only")
    output = client.post("/api/v1/analyze", data={"mode": "classification"},
                         files={"file": ("fixture.png", png_bytes(), "image/png")})
    assert output.status_code == 200
    analysis = output.json()
    assert analysis["model_version"] == MODEL_VERSION
    assert analysis["status"] == "complete"
    assert analysis["finding"]["needs_review"]
    assert analysis["predicted_class"] == "no_tumor"
    assert analysis["model_confidence_score"] == 0.97
    assert analysis["finding"]["final_label"] == "possible_tumor (type unclear)"
    assert analysis["finding"]["class"] == "no_tumor"
    assert analysis["finding"]["confidence"] == 0.97
    assert analysis["finding"]["mask_uncertain"]
    assert analysis["finding"]["overlay_png_base64"] == encoded_overlay

    receipt = analysis["analysis_receipt"]
    replaced = client.post("/api/v1/report", json={
        "analysis_receipt": receipt, "segmentation_png_base64": encoded_overlay,
    })
    assert replaced.status_code == 422
    correct = client.post("/api/v1/report", json={
        "analysis_receipt": receipt, "segmentation_png_base64": encoded_mask,
    })
    assert correct.status_code == 200
    assert correct.content.startswith(b"%PDF")
