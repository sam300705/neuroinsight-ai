from __future__ import annotations

import argparse
import json
from pathlib import Path

import nibabel as nib
import numpy as np
import torch
from PIL import Image
from torch.nn import functional as F

from train import TinyUNet


def normalize(volume: np.ndarray) -> np.ndarray:
    result = volume.astype(np.float32).copy()
    for channel in range(result.shape[-1]):
        values = result[..., channel][result[..., channel] != 0]
        if values.size: result[..., channel] = (result[..., channel] - values.mean()) / max(float(values.std()), 1e-6)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument("--checkpoint", type=Path, required=True); parser.add_argument("--volume", type=Path, required=True); parser.add_argument("--output", type=Path, required=True); parser.add_argument("--threshold", type=float, default=0.5); args = parser.parse_args()
    saved = torch.load(args.checkpoint, map_location="cpu", weights_only=True); model = TinyUNet(); model.load_state_dict(saved["state_dict"]); model.eval(); image = nib.load(str(args.volume)); volume = normalize(np.asarray(image.dataobj)); mask = np.zeros(volume.shape[:3], dtype=np.uint8)
    with torch.inference_mode():
        for index in range(volume.shape[2]):
            channels = torch.from_numpy(volume[:, :, index, :].transpose(2, 0, 1)).unsqueeze(0); resized = F.interpolate(channels, size=(saved["image_size"], saved["image_size"]), mode="bilinear", align_corners=False); prediction = torch.sigmoid(model(resized)); restored = F.interpolate(prediction, size=volume.shape[:2], mode="bilinear", align_corners=False)[0, 0].numpy(); mask[:, :, index] = (restored >= args.threshold).astype(np.uint8)
    args.output.mkdir(parents=True, exist_ok=True); mask_path = args.output / "whole_tumor_mask.nii.gz"; nib.save(nib.Nifti1Image(mask, image.affine, image.header), str(mask_path)); slice_index = int(np.argmax(mask.sum(axis=(0, 1)))); base = volume[:, :, slice_index, 0]; base = (base - base.min()) / max(float(base.max() - base.min()), 1e-8); overlay = np.stack([base, base, base], axis=-1); overlay[mask[:, :, slice_index] > 0] = 0.5 * overlay[mask[:, :, slice_index] > 0] + 0.5 * np.array([1, 0.1, 0.25]); overlay_path = args.output / "segmentation_overlay.png"; Image.fromarray((overlay * 255).astype(np.uint8)).save(overlay_path)
    spacing = [float(value) for value in image.header.get_zooms()[:3]]; voxel_count = int(mask.sum()); volume_ml = voxel_count * float(np.prod(spacing)) / 1000
    (args.output / "inference.json").write_text(json.dumps({"mask": str(mask_path), "overlay": str(overlay_path), "slice_index": slice_index, "voxel_count": voxel_count, "spacing_mm": spacing, "volume_ml": volume_ml, "threshold": args.threshold, "limitations": ["Exploratory TinyUNet2D checkpoint; no deployment approval.", "Binary whole-tumor estimate combines source subregions.", "This reported voxel-derived volume is research metadata only, not clinical measurement."]}, indent=2), encoding="utf-8")
    print(json.dumps({"mask": str(mask_path), "overlay": str(overlay_path), "voxel_count": voxel_count, "volume_ml": volume_ml}))


if __name__ == "__main__": main()
