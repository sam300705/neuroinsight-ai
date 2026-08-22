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

MODEL_LABELS = ["glioma", "meningioma", "notumor", "pituitary"]
PUBLIC_LABELS = {"notumor": "no_tumor", "glioma": "glioma", "meningioma": "meningioma", "pituitary": "pituitary"}


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
        raise ValueError("Model artifact URLs must use HTTPS.")
    if destination.is_file() and hashlib.sha256(destination.read_bytes()).hexdigest() == expected_sha256:
        return destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".partial")
    digest = hashlib.sha256()
    with urlopen(url, timeout=90) as response, temporary.open("wb") as stream:
        while chunk := response.read(1024 * 1024):
            digest.update(chunk)
            stream.write(chunk)
    if digest.hexdigest() != expected_sha256:
        temporary.unlink(missing_ok=True)
        raise ValueError("Downloaded model artifact checksum does not match the audited configured value.")
    temporary.replace(destination)
    return destination


class OnnxExperimentalClassifier:
    def __init__(self, model_path: Path, metadata_path: Path, calibration_path: Path):
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        if metadata.get("architecture") != "resnet50" or metadata.get("labels") != MODEL_LABELS:
            raise ValueError("Configured ONNX metadata does not match the audited ResNet50 four-class contract.")
        self.image_size = int(metadata["image_size"])
        self.fc_weights = np.asarray(metadata["final_fc_weights"], dtype=np.float32)
        if self.fc_weights.shape != (4, 2048):
            raise ValueError("Configured ONNX metadata has an incompatible classifier weight shape.")
        calibration = json.loads(calibration_path.read_text(encoding="utf-8"))
        self.temperature = float(calibration["temperature"])
        self.abstention_threshold = float(calibration["abstention_policy"]["threshold"])
        self.session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])

    def predict(self, payload: bytes) -> ExperimentalPrediction:
        image = Image.open(io.BytesIO(payload)).convert("RGB")
        input_image = image.resize((self.image_size, self.image_size), Image.Resampling.BILINEAR)
        tensor = np.asarray(input_image, dtype=np.float32) / 255.0
        tensor = (tensor - np.asarray([0.485, 0.456, 0.406], dtype=np.float32)) / np.asarray([0.229, 0.224, 0.225], dtype=np.float32)
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
        return None
    cache_dir = Path(os.getenv("MODEL_CACHE_DIR", "/tmp/neuroinsight-model"))
    model_path = _download_verified_https(os.environ["CLASSIFICATION_ONNX_URL"], cache_dir / "experimental-classifier.onnx", os.environ["CLASSIFICATION_ONNX_SHA256"])
    metadata_path = _download_verified_https(os.environ["CLASSIFICATION_ONNX_METADATA_URL"], cache_dir / "experimental-classifier-metadata.json", os.environ["CLASSIFICATION_ONNX_METADATA_SHA256"])
    calibration_path = _download_verified_https(os.environ["CLASSIFICATION_CALIBRATION_URL"], cache_dir / "experimental-calibration.json", os.environ["CLASSIFICATION_CALIBRATION_SHA256"])
    return OnnxExperimentalClassifier(model_path, metadata_path, calibration_path)
