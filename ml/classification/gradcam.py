from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torchvision import transforms

from train import create_model


def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument("--checkpoint", type=Path, required=True); parser.add_argument("--image", type=Path, required=True); parser.add_argument("--output", type=Path, required=True); args = parser.parse_args()
    saved = torch.load(args.checkpoint, map_location="cpu", weights_only=True); model, _ = create_model(saved["architecture"], pretrained=False); model.load_state_dict(saved["state_dict"]); model.eval()
    target = model.layer4[-1] if saved["architecture"] == "resnet50" else model.features[-1]
    activations, gradients = [], []
    target.register_forward_hook(lambda _, __, output: activations.append(output.detach()))
    target.register_full_backward_hook(lambda _, grad_input, grad_output: gradients.append(grad_output[0].detach()))
    image = Image.open(args.image).convert("RGB"); size = saved["image_size"]; tensor = transforms.Compose([transforms.Resize((size, size)), transforms.ToTensor(), transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])(image).unsqueeze(0)
    logits = model(tensor); index = int(logits.argmax(dim=1).item()); model.zero_grad(); logits[0, index].backward(); weights = gradients[0].mean(dim=(2, 3), keepdim=True); heatmap = torch.relu((weights * activations[0]).sum(dim=1, keepdim=True)); heatmap = torch.nn.functional.interpolate(heatmap, size=(image.height, image.width), mode="bilinear", align_corners=False)[0, 0].numpy(); heatmap = (heatmap - heatmap.min()) / max(float(heatmap.max() - heatmap.min()), 1e-8)
    base = np.asarray(image, dtype=np.float32) / 255; color = np.zeros_like(base); color[..., 0] = heatmap; color[..., 1] = 0.15 + 0.55 * (1 - np.abs(heatmap - 0.5) * 2); color[..., 2] = 1 - heatmap; overlay = np.clip(0.52 * base + 0.48 * color, 0, 1); args.output.parent.mkdir(parents=True, exist_ok=True); Image.fromarray((overlay * 255).astype(np.uint8)).save(args.output)
    print({"predicted_class": saved["labels"][index], "output": str(args.output), "disclaimer": "Coarse classifier attribution only; not a tumor boundary."})


if __name__ == "__main__": main()
