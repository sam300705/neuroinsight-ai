from __future__ import annotations

import numpy as np

from .schemas import Measurement


def measure_2d(mask: np.ndarray, spacing_mm: tuple[float, float] | None = None) -> Measurement:
    if mask.ndim != 2:
        raise ValueError("2D area measurement requires a two-dimensional mask")
    pixel_count = int(np.count_nonzero(mask))
    occupancy_percent = float(pixel_count / mask.size * 100) if mask.size else 0.0
    if spacing_mm is None or any(value <= 0 for value in spacing_mm):
        return Measurement(
            kind="relative_area",
            pixel_count=pixel_count,
            occupancy_percent=occupancy_percent,
            unit="pixels",
            metadata_confirmed=False,
            limitation="Pixel spacing is unavailable; physical area is not reported.",
        )
    area_mm2 = pixel_count * spacing_mm[0] * spacing_mm[1]
    return Measurement(
        kind="physical_area",
        pixel_count=pixel_count,
        occupancy_percent=occupancy_percent,
        value=float(area_mm2),
        unit="mm²",
        metadata_confirmed=True,
        limitation="Physical area uses confirmed in-plane pixel spacing.",
    )


def measure_volume(mask: np.ndarray, spacing_mm: tuple[float, float, float] | None = None) -> Measurement:
    if mask.ndim != 3:
        raise ValueError("Volume measurement requires a three-dimensional mask")
    voxel_count = int(np.count_nonzero(mask))
    occupancy_percent = float(voxel_count / mask.size * 100) if mask.size else 0.0
    if spacing_mm is None or any(value <= 0 for value in spacing_mm):
        return Measurement(
            kind="relative_area",
            voxel_count=voxel_count,
            occupancy_percent=occupancy_percent,
            unit="voxels",
            metadata_confirmed=False,
            limitation="Voxel spacing is unavailable; physical volume is not reported.",
        )
    volume_ml = voxel_count * spacing_mm[0] * spacing_mm[1] * spacing_mm[2] / 1000
    return Measurement(
        kind="physical_volume",
        voxel_count=voxel_count,
        occupancy_percent=occupancy_percent,
        value=float(volume_ml),
        unit="mL",
        metadata_confirmed=True,
        limitation="Physical volume uses confirmed three-dimensional voxel spacing.",
    )

