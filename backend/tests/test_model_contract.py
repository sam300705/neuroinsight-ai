import base64
import hashlib
from io import BytesIO
import json

import numpy as np
import pytest
from PIL import Image

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


class DownloadResponse:
    def __init__(self, payload: bytes, *, url: str = "https://allowed.example/artifact", content_length: str | None = None):
        self.remaining = payload
        self.url = url
        self.headers = {} if content_length is None else {"Content-Length": content_length}

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self, size=-1):
        if size < 0:
            chunk, self.remaining = self.remaining, b""
        else:
            chunk, self.remaining = self.remaining[:size], self.remaining[size:]
        return chunk


def test_download_rejects_invalid_digest_and_disallowed_original_host_before_network(tmp_path, monkeypatch):
    monkeypatch.setattr("neuroinsight_api.onnx_classifier_runtime.urlopen", lambda *_args, **_kwargs: pytest.fail("must not download"))
    with pytest.raises(ClassifierInitializationError, match="artifact_invalid"):
        _download_verified_https("https://allowed.example/model.onnx", tmp_path / "model.onnx", "not-a-digest")

    monkeypatch.setenv("MODEL_ARTIFACT_ALLOWED_HOSTS", "allowed.example")
    with pytest.raises(ClassifierInitializationError, match="download_failed"):
        _download_verified_https("https://other.example/model.onnx", tmp_path / "model.onnx", hashlib.sha256(b"ok").hexdigest())


@pytest.mark.parametrize(
    "response",
    [
        DownloadResponse(b"abc", content_length=str(10)),
        DownloadResponse(b"abcdef", content_length=None),
        DownloadResponse(b"abc", url="http://allowed.example/downgraded"),
        DownloadResponse(b"abc", url="https://other.example/redirected"),
    ],
)
def test_download_rejects_oversize_truncated_and_unsafe_redirects_and_removes_partial_files(tmp_path, monkeypatch, response):
    monkeypatch.setenv("MODEL_ARTIFACT_ALLOWED_HOSTS", "allowed.example")
    monkeypatch.setattr("neuroinsight_api.onnx_classifier_runtime.urlopen", lambda *_args, **_kwargs: response)
    destination = tmp_path / "model.onnx"
    expected = hashlib.sha256(b"abc").hexdigest()
    with pytest.raises(ClassifierInitializationError):
        _download_verified_https("https://allowed.example/model.onnx", destination, expected, max_bytes=5)
    assert not destination.exists()
    assert not (tmp_path / "model.onnx.partial").exists()


def test_download_accepts_valid_cached_artifact_without_network(tmp_path, monkeypatch):
    destination = tmp_path / "model.onnx"
    destination.write_bytes(b"cached")
    expected = hashlib.sha256(b"cached").hexdigest()
    monkeypatch.setattr("neuroinsight_api.onnx_classifier_runtime.urlopen", lambda *_args, **_kwargs: pytest.fail("valid cache must not download"))
    assert _download_verified_https("https://allowed.example/model.onnx", destination, expected) == destination


def test_onnx_initialization_checks_input_output_names_and_fixed_160px_shapes(tmp_path, monkeypatch):
    metadata = tmp_path / "metadata.json"
    calibration = tmp_path / "calibration.json"
    model = tmp_path / "model.onnx"
    metadata.write_text(json.dumps({"architecture": "resnet50", "labels": MODEL_LABELS, "image_size": 160, "final_fc_weights": [[0] * 2048] * 4}), encoding="utf-8")
    calibration.write_text(json.dumps({"temperature": 0.689875, "abstention_policy": {"threshold": 0.55}}), encoding="utf-8")
    model.write_bytes(b"fixture")

    class Item:
        def __init__(self, name, shape):
            self.name, self.shape = name, shape

    class ValidSession:
        def get_inputs(self):
            return [Item("image", [None, 3, 160, 160])]

        def get_outputs(self):
            return [Item("logits", [None, 4]), Item("feature_maps", [None, 2048, 5, 5])]

    monkeypatch.setattr("neuroinsight_api.onnx_classifier_runtime.ort.InferenceSession", lambda *_args, **_kwargs: ValidSession())
    assert OnnxExperimentalClassifier(model, metadata, calibration).image_size == 160

    class StaticBatchSession(ValidSession):
        def get_inputs(self):
            return [Item("image", [1, 3, 160, 160])]

        def get_outputs(self):
            return [Item("logits", [1, 4]), Item("feature_maps", [1, 2048, 5, 5])]

    monkeypatch.setattr("neuroinsight_api.onnx_classifier_runtime.ort.InferenceSession", lambda *_args, **_kwargs: StaticBatchSession())
    assert OnnxExperimentalClassifier(model, metadata, calibration).image_size == 160

    class InvalidSession(ValidSession):
        def get_outputs(self):
            return [Item("logits", [None, 4]), Item("feature_maps", [None, 2048, 7, 7])]

    monkeypatch.setattr("neuroinsight_api.onnx_classifier_runtime.ort.InferenceSession", lambda *_args, **_kwargs: InvalidSession())
    with pytest.raises(ClassifierInitializationError, match="contract_mismatch"):
        OnnxExperimentalClassifier(model, metadata, calibration)


def test_grad_cam_overlay_is_bounded_independently_of_upload_resolution(tmp_path, monkeypatch):
    metadata = tmp_path / "metadata.json"
    calibration = tmp_path / "calibration.json"
    model = tmp_path / "model.onnx"
    weights = [[0.0] * 2048 for _ in range(4)]
    weights[0][0] = 1.0
    metadata.write_text(json.dumps({"architecture": "resnet50", "labels": MODEL_LABELS, "image_size": 160, "final_fc_weights": weights}), encoding="utf-8")
    calibration.write_text(json.dumps({"temperature": 1.0, "abstention_policy": {"threshold": 0.55}}), encoding="utf-8")
    model.write_bytes(b"fixture")

    class Item:
        def __init__(self, name, shape):
            self.name, self.shape = name, shape

    class PredictionSession:
        def get_inputs(self):
            return [Item("image", [1, 3, 160, 160])]

        def get_outputs(self):
            return [Item("logits", [1, 4]), Item("feature_maps", [1, 2048, 5, 5])]

        def run(self, _outputs, _inputs):
            logits = np.asarray([[4.0, 0.0, 0.0, 0.0]], dtype=np.float32)
            feature_maps = np.zeros((1, 2048, 5, 5), dtype=np.float32)
            feature_maps[0, 0, 1:4, 1:4] = 1.0
            return logits, feature_maps

    monkeypatch.setattr("neuroinsight_api.onnx_classifier_runtime.ort.InferenceSession", lambda *_args, **_kwargs: PredictionSession())
    classifier = OnnxExperimentalClassifier(model, metadata, calibration)
    source = BytesIO()
    Image.linear_gradient("L").resize((1200, 900)).save(source, format="PNG")
    prediction = classifier.predict(source.getvalue())
    with Image.open(BytesIO(base64.b64decode(prediction.grad_cam_png_base64))) as overlay:
        assert max(overlay.size) <= 512
