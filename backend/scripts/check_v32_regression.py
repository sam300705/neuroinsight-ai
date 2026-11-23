"""Run all eight private handoff fixtures through the verified public predict method."""

import argparse
import base64
import csv
import io
import math
import resource
import time
from pathlib import Path

import numpy as np
from PIL import Image

from neuroinsight_api.v32_runtime import load_pipeline


def image_data(encoded: str):
    with Image.open(io.BytesIO(base64.b64decode(encoded, validate=True))) as image:
        return np.array(image)


def compare(result, row, source_size):
    issues = []
    exact = {
        "class": row["pred"],
        "final_label": row["final_label"],
        "tumor_detected": row["final_tumor"] == "True",
        "needs_review": row["needs_review"] == "True",
        "mask_uncertain": row["mask_uncertain"] == "True",
    }
    for key, expected in exact.items():
        if result[key] != expected:
            issues.append(f"{key}: {result[key]!r} versus {expected!r}")
    expected_area = int(row["tumor_px"])
    for key, column, tolerance in (
        ("confidence", "conf", 0.01),
        ("seg_presence", "seg_pres", 0.01),
        ("seg_uncertainty", "unc", 0.01),
        ("tumor_area_px", "tumor_px", max(50, expected_area * 0.03)),
        ("tumor_pct_of_brain", "pct_brain", 0.5),
    ):
        expected = float(row[column]) if row[column] else None
        observed = result[key]
        if expected is None or observed is None:
            matches = expected is None and observed is None
        else:
            matches = math.isclose(observed, expected, abs_tol=tolerance, rel_tol=0)
        if not matches:
            issues.append(f"{key}: {observed!r} versus {expected!r} (tolerance {tolerance:g})")

    width, height = source_size
    if result["image"] != {"width": width, "height": height}:
        issues.append("image dimensions differ from source")
    if result["mask_png_base64"]:
        mask = image_data(result["mask_png_base64"])
        overlay = image_data(result["overlay_png_base64"])
        if mask.shape != (height, width) or not np.isin(mask, (0, 255)).all():
            issues.append("mask must be binary and match source dimensions")
        if overlay.shape != (height, width, 3):
            issues.append("overlay dimensions differ from source")
        ys, xs = np.where(mask > 0)
        if len(xs) == 0 or len(xs) != result["tumor_area_px"]:
            issues.append("mask pixel count differs from stated area")
        elif result["bbox"] != dict(x_min=int(xs.min()), y_min=int(ys.min()), x_max=int(xs.max()), y_max=int(ys.max())):
            issues.append("mask bounding box differs from stated coordinates")
        if not math.isclose(result["tumor_pct_of_image"], len(xs) * 100 / (width * height), abs_tol=1e-6):
            issues.append("whole-image percentage differs from the mask area ratio")
    elif any((result["bbox"], result["overlay_png_base64"], result["tumor_area_px"], result["tumor_pct_of_image"])):
        issues.append("result describes a mask without returning one")
    return issues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("handoff", type=Path)
    args = parser.parse_args()
    fixture_dir = args.handoff / "test_data"
    images = sorted(path for path in (fixture_dir / "images").iterdir() if path.suffix.lower() in {".jpeg", ".jpg"})
    wanted = {path.name for path in images}
    references = {}
    with (fixture_dir / "integration_v3_results.csv").open(newline="") as source:
        for row in csv.DictReader(source):
            name = Path(row["file"]).name
            if name in wanted:
                if name in references:
                    raise ValueError(f"Duplicate reference for {name}")
                references[name] = row
    if len(wanted) != 8 or references.keys() != wanted:
        raise ValueError(f"Expected eight exact basename matches. Found {len(images)} JPEGs and {len(references)} matching rows.")

    start = time.perf_counter()
    pipeline = load_pipeline(args.handoff / "backend/models")
    print(f"Startup: {time.perf_counter() - start:.2f} s; peak RSS: {resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024:.0f} MiB", flush=True)
    failures = 0
    for path in images:
        start = time.perf_counter()
        result = pipeline.predict(path.read_bytes())
        elapsed = time.perf_counter() - start
        with Image.open(path) as image:
            source_size = image.size
        issues = compare(result, references[path.name], source_size)
        failures += bool(issues)
        print(
            f"{path.name} | {result['class']} | {result['final_label']} | "
            f"{result['confidence']:.4f} | {result['tumor_area_px']} px | "
            f"{elapsed:.2f} s | {'; '.join(issues) if issues else 'PASS'}",
            flush=True,
        )
    print(f"{len(images) - failures}/{len(images)} passed. Peak RSS: {resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024:.0f} MiB.")
    return int(failures > 0)


if __name__ == "__main__":
    raise SystemExit(main())
