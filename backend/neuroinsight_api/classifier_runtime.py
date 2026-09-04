"""Optional experimental runtime for a locally configured audited classifier.

No checkpoint is bundled with the service. The caller must provide explicit
local paths through environment variables; otherwise callers receive the
honest unavailable-model response from the API layer.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import os
from urllib.parse import urlparse
from urllib.request import urlopen
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torchvision import models, transforms
from .constants import MAX_GRAD_CAM_EDGE_PIXELS

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


def _create_model(architecture: str) -> torch.nn.Module:
    if architecture != "resnet50":
        raise ValueError(f"Unsupported experimental classification architecture: {architecture}")
    model = models.resnet50(weights=None)
    model.fc = torch.nn.Linear(model.fc.in_features, 4)
    return model


class ExperimentalClassifier:
    def __init__(self, checkpoint_path: Path, calibration_path: Path):
        saved = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        if saved.get("architecture") != "resnet50" or saved.get("labels") != MODEL_LABELS:
            raise ValueError("Configured checkpoint does not match the supported audited ResNet50 four-class contract.")
        self.model = _create_model(saved["architecture"])
        self.model.load_state_dict(saved["state_dict"])
        self.model.eval()
        self.image_size = int(saved["image_size"])
        calibration = json.loads(calibration_path.read_text(encoding="utf-8"))
        self.temperature = float(calibration["temperature"])
        self.abstention_threshold = float(calibration["abstention_policy"]["threshold"])
        self.transform = transforms.Compose([
            transforms.Resize((self.image_size, self.image_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        self.target_layer = self.model.layer4[-1]

    def predict(self, payload: bytes) -> ExperimentalPrediction:
        image = Image.open(io.BytesIO(payload)).convert("RGB")
        overlay_base = image.copy()
        overlay_base.thumbnail((MAX_GRAD_CAM_EDGE_PIXELS, MAX_GRAD_CAM_EDGE_PIXELS), Image.Resampling.LANCZOS)
        tensor = self.transform(image).unsqueeze(0)
        activations: list[torch.Tensor] = []
        gradients: list[torch.Tensor] = []
        forward = self.target_layer.register_forward_hook(lambda _, __, output: activations.append(output))
        backward = self.target_layer.register_full_backward_hook(lambda _, __, grad_output: gradients.append(grad_output[0]))
        try:
            logits = self.model(tensor)
            scaled_logits = logits / self.temperature
            probabilities = torch.softmax(scaled_logits, dim=1)
            index = int(probabilities.argmax(dim=1).item())
            confidence = float(probabilities[0, index].item())
            self.model.zero_grad(set_to_none=True)
            logits[0, index].backward()
            weights = gradients[0].mean(dim=(2, 3), keepdim=True)
            heatmap = torch.relu((weights * activations[0]).sum(dim=1, keepdim=True))
            heatmap = torch.nn.functional.interpolate(heatmap, size=(overlay_base.height, overlay_base.width), mode="bilinear", align_corners=False)[0, 0].detach().numpy()
        finally:
            forward.remove()
            backward.remove()
        heatmap = (heatmap - heatmap.min()) / max(float(heatmap.max() - heatmap.min()), 1e-8)
        base = np.asarray(overlay_base, dtype=np.float32) / 255.0
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


def configured_classifier() -> ExperimentalClassifier | None:
    checkpoint = os.getenv("CLASSIFICATION_CHECKPOINT")
    calibration = os.getenv("CLASSIFICATION_CALIBRATION")
    if checkpoint and calibration:
        checkpoint_path, calibration_path = Path(checkpoint), Path(calibration)
        if checkpoint_path.is_file() and calibration_path.is_file():
            return ExperimentalClassifier(checkpoint_path, calibration_path)
    if os.getenv("ENABLE_EXPERIMENTAL_MODEL", "false").lower() != "true":
        return None
    checkpoint_url = os.getenv("CLASSIFICATION_CHECKPOINT_URL")
    calibration_url = os.getenv("CLASSIFICATION_CALIBRATION_URL")
    checkpoint_sha256 = os.getenv("CLASSIFICATION_CHECKPOINT_SHA256")
    calibration_sha256 = os.getenv("CLASSIFICATION_CALIBRATION_SHA256")
    if not checkpoint_url or not calibration_url or not checkpoint_sha256 or not calibration_sha256:
        return None
    cache_dir = Path(os.getenv("MODEL_CACHE_DIR", "/tmp/neuroinsight-model"))
    checkpoint_path = _download_verified_https(checkpoint_url, cache_dir / "experimental-classifier.pt", checkpoint_sha256)
    calibration_path = _download_verified_https(calibration_url, cache_dir / "experimental-calibration.json", calibration_sha256)
    return ExperimentalClassifier(checkpoint_path, calibration_path)


def _download_verified_https(url: str, destination: Path, expected_sha256: str) -> Path:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("Model artifact URLs must use HTTPS.")
    if destination.is_file():
        existing = hashlib.sha256(destination.read_bytes()).hexdigest()
        if existing == expected_sha256:
            return destination
        destination.unlink()
    destination.parent.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    temporary = destination.with_suffix(destination.suffix + ".partial")
    with urlopen(url, timeout=90) as response, temporary.open("wb") as stream:
        while chunk := response.read(1024 * 1024):
            digest.update(chunk)
            stream.write(chunk)
    if digest.hexdigest() != expected_sha256:
        temporary.unlink(missing_ok=True)
        raise ValueError("Downloaded model artifact checksum does not match the audited configured value.")
    temporary.replace(destination)
    return destination
