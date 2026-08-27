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
from .model_contract import MODEL_LABELS, PUBLIC_LABELS, NORMALIZATION_MEAN, NORMALIZATION_STD, validate_calibration, validate_metadata


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


def _download_verified_https(url: str, destination: Path, expected_sha256: str) -> Path:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ClassifierInitializationError("download_failed")
    if destination.is_file() and hashlib.sha256(destination.read_bytes()).hexdigest() == expected_sha256:
        return destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".partial")
    digest = hashlib.sha256()
    try:
        with urlopen(url, timeout=90) as response, temporary.open("wb") as stream:
            while chunk := response.read(1024 * 1024):
                digest.update(chunk)
                stream.write(chunk)
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
        except Exception as exc:
            raise ClassifierInitializationError("onnx_initialization_failed") from exc

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
    model_path = _download_verified_https(os.environ["CLASSIFICATION_ONNX_URL"], cache_dir / "experimental-classifier.onnx", os.environ["CLASSIFICATION_ONNX_SHA256"])
    metadata_path = _download_verified_https(os.environ["CLASSIFICATION_ONNX_METADATA_URL"], cache_dir / "experimental-classifier-metadata.json", os.environ["CLASSIFICATION_ONNX_METADATA_SHA256"])
    calibration_path = _download_verified_https(os.environ["CLASSIFICATION_CALIBRATION_URL"], cache_dir / "experimental-calibration.json", os.environ["CLASSIFICATION_CALIBRATION_SHA256"])
    return OnnxExperimentalClassifier(model_path, metadata_path, calibration_path)
