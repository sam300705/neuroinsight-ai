from __future__ import annotations

from typing import Any

MODEL_LABELS = ["glioma", "meningioma", "notumor", "pituitary"]
PUBLIC_LABELS = {"notumor": "no_tumor", "glioma": "glioma", "meningioma": "meningioma", "pituitary": "pituitary"}
IMAGE_SIZE = 160
NORMALIZATION_MEAN = (0.485, 0.456, 0.406)
NORMALIZATION_STD = (0.229, 0.224, 0.225)


def validate_metadata(metadata: dict[str, Any]) -> int:
    if metadata.get("architecture") != "resnet50" or metadata.get("labels") != MODEL_LABELS:
        raise ValueError("Configured ONNX metadata does not match the audited ResNet50 four-class contract.")
    image_size = int(metadata["image_size"])
    if image_size != IMAGE_SIZE:
        raise ValueError("Configured ONNX metadata has an unexpected image size.")
    return image_size


def validate_calibration(calibration: dict[str, Any]) -> tuple[float, float]:
    temperature = float(calibration["temperature"])
    threshold = float(calibration["abstention_policy"]["threshold"])
    if temperature <= 0 or not 0 < threshold < 1:
        raise ValueError("Configured calibration does not meet the audited temperature/abstention contract.")
    return temperature, threshold
