import hashlib
import json

import pytest

from neuroinsight_api.model_contract import IMAGE_SIZE, MODEL_LABELS, NORMALIZATION_MEAN, NORMALIZATION_STD, PUBLIC_LABELS, validate_calibration, validate_metadata
from neuroinsight_api.onnx_classifier_runtime import ClassifierInitializationError, OnnxExperimentalClassifier, _download_verified_https, configured_onnx_classifier


def test_exp005_label_and_preprocessing_contract_is_fixed():
    assert MODEL_LABELS == ["glioma", "meningioma", "notumor", "pituitary"]
    assert PUBLIC_LABELS["notumor"] == "no_tumor"
    assert IMAGE_SIZE == 160
    assert NORMALIZATION_MEAN == (0.485, 0.456, 0.406)
    assert NORMALIZATION_STD == (0.229, 0.224, 0.225)


def test_exp005_metadata_and_calibration_reject_contract_drift():
    assert validate_metadata({"architecture": "resnet50", "labels": MODEL_LABELS, "image_size": 160}) == 160
    assert validate_calibration({"temperature": 0.689875, "abstention_policy": {"threshold": 0.55}}) == (0.689875, 0.55)
    with pytest.raises(ValueError):
        validate_metadata({"architecture": "resnet18", "labels": MODEL_LABELS, "image_size": 160})
    with pytest.raises(ValueError):
        validate_calibration({"temperature": 0, "abstention_policy": {"threshold": 1}})


def test_configured_onnx_classifier_categorises_missing_artifact_configuration(monkeypatch):
    monkeypatch.setenv("ENABLE_EXPERIMENTAL_MODEL", "true")
    for key in (
        "CLASSIFICATION_ONNX_URL",
        "CLASSIFICATION_ONNX_SHA256",
        "CLASSIFICATION_ONNX_METADATA_URL",
        "CLASSIFICATION_ONNX_METADATA_SHA256",
        "CLASSIFICATION_CALIBRATION_URL",
        "CLASSIFICATION_CALIBRATION_SHA256",
    ):
        monkeypatch.delenv(key, raising=False)
    with pytest.raises(ClassifierInitializationError, match="artifact_missing") as error:
        configured_onnx_classifier()
    assert error.value.category == "artifact_missing"


def test_onnx_initialization_categories_preserve_contract_and_checksum_checks(tmp_path, monkeypatch):
    metadata = tmp_path / "metadata.json"
    calibration = tmp_path / "calibration.json"
    model = tmp_path / "model.onnx"
    metadata.write_text(json.dumps({"architecture": "resnet50", "labels": MODEL_LABELS, "image_size": 224}), encoding="utf-8")
    calibration.write_text(json.dumps({"temperature": 0.689875, "abstention_policy": {"threshold": 0.55}}), encoding="utf-8")
    model.write_bytes(b"not-an-onnx-model")

    with pytest.raises(ClassifierInitializationError, match="contract_mismatch") as error:
        OnnxExperimentalClassifier(model, metadata, calibration)
    assert error.value.category == "contract_mismatch"

    class Response:
        def __init__(self):
            self.remaining = b"unexpected-bytes"

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def read(self, _=-1):
            chunk, self.remaining = self.remaining, b""
            return chunk

    monkeypatch.setattr("neuroinsight_api.onnx_classifier_runtime.urlopen", lambda *_args, **_kwargs: Response())
    with pytest.raises(ClassifierInitializationError, match="checksum_mismatch") as error:
        _download_verified_https("https://example.invalid/model.onnx", tmp_path / "download.onnx", hashlib.sha256(b"expected").hexdigest())
    assert error.value.category == "checksum_mismatch"
