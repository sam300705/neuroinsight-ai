"""Export the audited experimental ResNet50 checkpoint to ONNX for lightweight CPU inference."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import torch
from torchvision import models

EXPECTED_LABELS = ["glioma", "meningioma", "notumor", "pituitary"]


class ResNet50CamExport(torch.nn.Module):
    def __init__(self, model: torch.nn.Module):
        super().__init__()
        self.features = torch.nn.Sequential(
            model.conv1,
            model.bn1,
            model.relu,
            model.maxpool,
            model.layer1,
            model.layer2,
            model.layer3,
            model.layer4,
        )
        self.avgpool = model.avgpool
        self.fc = model.fc

    def forward(self, image: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        feature_maps = self.features(image)
        logits = self.fc(torch.flatten(self.avgpool(feature_maps), 1))
        return logits, feature_maps


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, required=True)
    args = parser.parse_args()

    saved = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    if saved.get("architecture") != "resnet50" or saved.get("labels") != EXPECTED_LABELS:
        raise ValueError("Checkpoint does not match the audited four-class ResNet50 contract.")
    image_size = int(saved["image_size"])
    model = models.resnet50(weights=None)
    model.fc = torch.nn.Linear(model.fc.in_features, len(EXPECTED_LABELS))
    model.load_state_dict(saved["state_dict"])
    model.eval()
    export_model = ResNet50CamExport(model).eval()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    sample = torch.zeros(1, 3, image_size, image_size)
    torch.onnx.export(
        export_model,
        sample,
        args.output,
        input_names=["image"],
        output_names=["logits", "feature_maps"],
        dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}, "feature_maps": {0: "batch"}},
        opset_version=17,
        dynamo=False,
    )
    args.metadata.write_text(
        json.dumps(
            {
                "architecture": "resnet50",
                "labels": EXPECTED_LABELS,
                "image_size": image_size,
                "checkpoint_sha256": hashlib.sha256(args.checkpoint.read_bytes()).hexdigest(),
                "onnx_sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(),
                "final_fc_weights": model.fc.weight.detach().tolist(),
                "scope": "EXP-005 experimental fixed image-level academic demonstration; not medical diagnosis",
            },
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
