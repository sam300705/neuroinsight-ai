import numpy as np
import pytest

from neuroinsight_api.measurement import measure_2d, measure_volume


def test_relative_area_without_spacing_uses_pixels_only():
    mask = np.array([[1, 0], [1, 1]], dtype=np.uint8)
    result = measure_2d(mask)
    assert result.kind == "relative_area"
    assert result.pixel_count == 3
    assert result.occupancy_percent == 75
    assert result.unit == "pixels"
    assert not result.metadata_confirmed


def test_physical_area_uses_confirmed_spacing():
    mask = np.array([[1, 0], [1, 1]], dtype=np.uint8)
    result = measure_2d(mask, (0.5, 0.5))
    assert result.kind == "physical_area"
    assert result.value == 0.75
    assert result.unit == "mm²"
    assert result.metadata_confirmed


def test_physical_volume_uses_confirmed_voxel_spacing():
    mask = np.ones((2, 2, 2), dtype=np.uint8)
    result = measure_volume(mask, (1.0, 1.0, 2.0))
    assert result.kind == "physical_volume"
    assert result.voxel_count == 8
    assert result.value == 0.016
    assert result.unit == "mL"


def test_measurement_rejects_wrong_dimensionality():
    with pytest.raises(ValueError):
        measure_2d(np.ones((2, 2, 2), dtype=np.uint8))
    with pytest.raises(ValueError):
        measure_volume(np.ones((2, 2), dtype=np.uint8))

