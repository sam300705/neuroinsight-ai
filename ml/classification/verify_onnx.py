"""Verify an ONNX export against the audited experimental PyTorch checkpoint."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
from torchvision import models


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--onnx", dest="onnx_path", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--max-abs-tolerance", type=float, default=0.002)
    args = parser.parse_args()

    metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
    saved = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    model = models.resnet50(weights=None)
    model.fc = torch.nn.Linear(model.fc.in_features, 4)
    model.load_state_dict(saved["state_dict"])
    model.eval()
    sample = torch.linspace(0, 1, steps=3 * metadata["image_size"] * metadata["image_size"], dtype=torch.float32).reshape(1, 3, metadata["image_size"], metadata["image_size"])
    with torch.no_grad():
        torch_logits = model(sample).numpy()
    graph = onnx.load(args.onnx_path)
    onnx.checker.check_model(graph)
    session = ort.InferenceSession(str(args.onnx_path), providers=["CPUExecutionProvider"])
    onnx_logits, feature_maps = session.run(["logits", "feature_maps"], {"image": sample.numpy()})
    max_abs_difference = float(np.max(np.abs(torch_logits - onnx_logits)))
    report = {
        "status": "passed" if max_abs_difference <= args.max_abs_tolerance else "failed",
        "max_abs_difference": max_abs_difference,
        "max_abs_tolerance": args.max_abs_tolerance,
        "torch_argmax": int(torch_logits.argmax(axis=1)[0]),
        "onnx_argmax": int(onnx_logits.argmax(axis=1)[0]),
        "input_shape": list(sample.shape),
        "feature_map_shape": list(feature_maps.shape),
    }
    args.report.write_text(json.dumps(report, indent=2), encoding="utf-8")
    if report["status"] != "passed" or report["torch_argmax"] != report["onnx_argmax"]:
        raise SystemExit("ONNX verification failed.")


if __name__ == "__main__":
    main()
