import pytest

from neuroinsight_api.model_contract import IMAGE_SIZE, MODEL_LABELS, NORMALIZATION_MEAN, NORMALIZATION_STD, PUBLIC_LABELS, validate_calibration, validate_metadata


def test_exp005_label_and_preprocessing_contract_is_fixed():
    assert MODEL_LABELS == ["glioma", "meningioma", "notumor", "pituitary"]
    assert PUBLIC_LABELS["notumor"] == "no_tumor"
    assert IMAGE_SIZE == 224
    assert NORMALIZATION_MEAN == (0.485, 0.456, 0.406)
    assert NORMALIZATION_STD == (0.229, 0.224, 0.225)


def test_exp005_metadata_and_calibration_reject_contract_drift():
    assert validate_metadata({"architecture": "resnet50", "labels": MODEL_LABELS, "image_size": 224}) == 224
    assert validate_calibration({"temperature": 0.689875, "abstention_policy": {"threshold": 0.55}}) == (0.689875, 0.55)
    with pytest.raises(ValueError):
        validate_metadata({"architecture": "resnet18", "labels": MODEL_LABELS, "image_size": 224})
    with pytest.raises(ValueError):
        validate_calibration({"temperature": 0, "abstention_policy": {"threshold": 1}})
