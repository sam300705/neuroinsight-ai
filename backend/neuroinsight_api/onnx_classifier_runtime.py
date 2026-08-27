"""Checksum-verified ONNX Runtime implementation of the audited EXP-005 classifier."""

from __future__ import annotations

import base64
import hashlib
import io
import json
import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen

import numpy as np
import onnxruntime as ort
from PIL import Image
from .model_contract import IMAGE_SIZE, MODEL_LABELS, PUBLIC_LABELS, NORMALIZATION_MEAN, NORMALIZATION_STD, validate_calibration, validate_metadata


MAX_ONNX_ARTIFACT_BYTES = 128 * 1024 * 1024
MAX_JSON_ARTIFACT_BYTES = 1 * 1024 * 1024
SHA256_PATTERN = set("0123456789abcdef")


class ClassifierInitializationError(RuntimeError):
    """A public-safe classification of an internal classifier startup failure."""

    def __init__(self, category: str):
        super().__init__(category)
        self.category = category


@dataclass(frozen=True)
class ExperimentalPrediction:
    predicted_class: str
    confidence: float
    calibrated: bool
    status: str
    uncertainty_reason: str | None
    grad_cam_png_base64: str


def _configured_artifact_hosts() -> set[str]:
    return {host.strip().lower() for host in os.getenv("MODEL_ARTIFACT_ALLOWED_HOSTS", "").split(",") if host.strip()}


def _validate_artifact_url(url: str) -> None:
    parsed = urlparse(url)
    hostname = parsed.hostname.lower() if parsed.hostname else ""
    if parsed.scheme != "https" or not hostname or parsed.username or parsed.password:
        raise ClassifierInitializationError("download_failed")
    allowed_hosts = _configured_artifact_hosts()
    if allowed_hosts and hostname not in allowed_hosts:
        raise ClassifierInitializationError("download_failed")


def _validate_sha256(expected_sha256: str) -> None:
    if len(expected_sha256) != 64 or any(char not in SHA256_PATTERN for char in expected_sha256):
        raise ClassifierInitializationError("artifact_invalid")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _content_length(response: object) -> int | None:
    headers = getattr(response, "headers", None)
    value = headers.get("Content-Length") if headers and hasattr(headers, "get") else None
    if value is None:
        return None
    try:
        length = int(value)
    except (TypeError, ValueError) as exc:
        raise ClassifierInitializationError("download_failed") from exc
    if length < 0:
        raise ClassifierInitializationError("download_failed")
    return length


def _download_verified_https(url: str, destination: Path, expected_sha256: str, *, max_bytes: int = MAX_JSON_ARTIFACT_BYTES) -> Path:
    _validate_artifact_url(url)
    _validate_sha256(expected_sha256)
    if max_bytes <= 0:
        raise ClassifierInitializationError("artifact_invalid")
    if destination.is_file() and _sha256_file(destination) == expected_sha256:
        return destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".partial")
    digest = hashlib.sha256()
    downloaded = 0
    try:
        with urlopen(url, timeout=90) as response, temporary.open("wb") as stream:
            _validate_artifact_url(getattr(response, "url", url))
            declared_length = _content_length(response)
            if declared_length is not None and declared_length > max_bytes:
                raise ClassifierInitializationError("download_too_large")
            while chunk := response.read(1024 * 1024):
                downloaded += len(chunk)
                if downloaded > max_bytes:
                    raise ClassifierInitializationError("download_too_large")
                digest.update(chunk)
                stream.write(chunk)
            if declared_length is not None and downloaded != declared_length:
                raise ClassifierInitializationError("download_failed")
    except ClassifierInitializationError:
        temporary.unlink(missing_ok=True)
        raise
    except Exception as exc:
        temporary.unlink(missing_ok=True)
        raise ClassifierInitializationError("download_failed") from exc
    if digest.hexdigest() != expected_sha256:
        temporary.unlink(missing_ok=True)
        raise ClassifierInitializationError("checksum_mismatch")
    temporary.replace(destination)
    return destination


class OnnxExperimentalClassifier:
    def __init__(self, model_path: Path, metadata_path: Path, calibration_path: Path):
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            self.image_size = validate_metadata(metadata)
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise ClassifierInitializationError("contract_mismatch") from exc
        try:
            self.fc_weights = np.asarray(metadata["final_fc_weights"], dtype=np.float32)
        except (KeyError, TypeError, ValueError) as exc:
            raise ClassifierInitializationError("metadata_invalid") from exc
        if self.fc_weights.shape != (4, 2048):
            raise ClassifierInitializationError("contract_mismatch")
        try:
            calibration = json.loads(calibration_path.read_text(encoding="utf-8"))
            self.temperature, self.abstention_threshold = validate_calibration(calibration)
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise ClassifierInitializationError("metadata_invalid") from exc
        try:
            self.session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
            self._validate_runtime_contract()
        except Exception as exc:
            if isinstance(exc, ClassifierInitializationError):
                raise
            raise ClassifierInitializationError("onnx_initialization_failed") from exc

    def _validate_runtime_contract(self) -> None:
        inputs = {item.name: item.shape for item in self.session.get_inputs()}
        outputs = {item.name: item.shape for item in self.session.get_outputs()}
        input_shape = list(inputs.get("image", []))
        logits_shape = list(outputs.get("logits", []))
        feature_maps_shape = list(outputs.get("feature_maps", []))
        if not (
            self._matches_batched_shape(input_shape, [3, IMAGE_SIZE, IMAGE_SIZE])
            and self._matches_batched_shape(logits_shape, [4])
            and self._matches_batched_shape(feature_maps_shape, [2048, 5, 5])
        ):
            raise ClassifierInitializationError("contract_mismatch")

    @staticmethod
    def _matches_batched_shape(shape: list[object], dimensions: list[int]) -> bool:
        """Allow only batch=1 or a named/dynamic batch; all model dimensions stay fixed."""
        return (
            len(shape) == len(dimensions) + 1
            and (shape[0] is None or shape[0] == 1 or (isinstance(shape[0], str) and bool(shape[0].strip())))
            and shape[1:] == dimensions
        )

    def predict(self, payload: bytes) -> ExperimentalPrediction:
        image = Image.open(io.BytesIO(payload)).convert("RGB")
        input_image = image.resize((self.image_size, self.image_size), Image.Resampling.BILINEAR)
        tensor = np.asarray(input_image, dtype=np.float32) / 255.0
        tensor = (tensor - np.asarray(NORMALIZATION_MEAN, dtype=np.float32)) / np.asarray(NORMALIZATION_STD, dtype=np.float32)
        tensor = np.transpose(tensor, (2, 0, 1))[None, ...]
        logits, feature_maps = self.session.run(["logits", "feature_maps"], {"image": tensor})
        scaled_logits = logits[0] / self.temperature
        probabilities = np.exp(scaled_logits - scaled_logits.max())
        probabilities /= probabilities.sum()
        index = int(probabilities.argmax())
        confidence = float(probabilities[index])
        heatmap = np.maximum((self.fc_weights[index, :, None, None] * feature_maps[0]).sum(axis=0), 0.0)
        heatmap = np.asarray(Image.fromarray(heatmap.astype(np.float32)).resize(image.size, Image.Resampling.BILINEAR), dtype=np.float32)
        heatmap = (heatmap - heatmap.min()) / max(float(heatmap.max() - heatmap.min()), 1e-8)
        base = np.asarray(image, dtype=np.float32) / 255.0
        colour = np.zeros_like(base)
        colour[..., 0] = heatmap
        colour[..., 1] = 0.15 + 0.55 * (1 - np.abs(heatmap - 0.5) * 2)
        colour[..., 2] = 1 - heatmap
        overlay = Image.fromarray((np.clip(0.52 * base + 0.48 * colour, 0, 1) * 255).astype(np.uint8))
        buffer = io.BytesIO()
        overlay.save(buffer, format="PNG", optimize=True)
        status = "complete" if confidence >= self.abstention_threshold else "low_confidence"
        return ExperimentalPrediction(
            predicted_class=PUBLIC_LABELS[MODEL_LABELS[index]],
            confidence=confidence,
            calibrated=True,
            status=status,
            uncertainty_reason=None if status == "complete" else "The experimental model confidence score is below the validation-derived abstention threshold; qualified review is required.",
            grad_cam_png_base64=base64.b64encode(buffer.getvalue()).decode("ascii"),
        )


def configured_onnx_classifier() -> OnnxExperimentalClassifier | None:
    if os.getenv("ENABLE_EXPERIMENTAL_MODEL", "false").lower() != "true":
        return None
    keys = ["CLASSIFICATION_ONNX_URL", "CLASSIFICATION_ONNX_SHA256", "CLASSIFICATION_ONNX_METADATA_URL", "CLASSIFICATION_ONNX_METADATA_SHA256", "CLASSIFICATION_CALIBRATION_URL", "CLASSIFICATION_CALIBRATION_SHA256"]
    if not all(os.getenv(key) for key in keys):
        raise ClassifierInitializationError("artifact_missing")
    cache_dir = Path(os.getenv("MODEL_CACHE_DIR", "/tmp/neuroinsight-model"))
    model_path = _download_verified_https(os.environ["CLASSIFICATION_ONNX_URL"], cache_dir / "experimental-classifier.onnx", os.environ["CLASSIFICATION_ONNX_SHA256"], max_bytes=MAX_ONNX_ARTIFACT_BYTES)
    metadata_path = _download_verified_https(os.environ["CLASSIFICATION_ONNX_METADATA_URL"], cache_dir / "experimental-classifier-metadata.json", os.environ["CLASSIFICATION_ONNX_METADATA_SHA256"], max_bytes=MAX_JSON_ARTIFACT_BYTES)
    calibration_path = _download_verified_https(os.environ["CLASSIFICATION_CALIBRATION_URL"], cache_dir / "experimental-calibration.json", os.environ["CLASSIFICATION_CALIBRATION_SHA256"], max_bytes=MAX_JSON_ARTIFACT_BYTES)
    return OnnxExperimentalClassifier(model_path, metadata_path, calibration_path)
