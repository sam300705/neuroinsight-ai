from __future__ import annotations

import gzip
import io
import warnings
from dataclasses import dataclass
from pathlib import Path

import nibabel as nib
import numpy as np
from PIL import Image, UnidentifiedImageError

from .constants import (
    MAX_CHROMATIC_PIXEL_FRACTION,
    MAX_IMAGE_PIXELS,
    MAX_UPLOAD_BYTES,
    MIN_CLASSIFICATION_EDGE_PIXELS,
    MIN_DARK_BORDER_FRACTION,
    MIN_LUMINANCE_DYNAMIC_RANGE,
    MIN_LUMINANCE_STANDARD_DEVIATION,
    MRI_PLAUSIBILITY_SAMPLE_EDGE,
)
from .schemas import AnalysisMode


class UploadValidationError(ValueError):
    """Raised when an upload does not satisfy the selected analysis mode."""


@dataclass(frozen=True)
class ValidatedUpload:
    filename: str
    media_type: str
    size_bytes: int


def _normalized_name(filename: str) -> str:
    name = Path(filename or "upload").name
    if name in {"", ".", ".."}:
        raise UploadValidationError("A safe file name is required.")
    return name


def _validate_mri_plausibility(image: Image.Image) -> None:
    """Reject obviously incompatible images before the experimental classifier.

    This deliberately conservative structural screen is not an MRI/OOD model and
    must not be represented as one. It prevents uniform, strongly chromatic, and
    full-frame photographic inputs from receiving a tumour-class prediction.
    """
    if min(image.size) < MIN_CLASSIFICATION_EDGE_PIXELS:
        raise UploadValidationError(
            f"Classification images must be at least {MIN_CLASSIFICATION_EDGE_PIXELS} pixels on each edge."
        )

    sample = image.convert("RGB")
    sample.thumbnail((MRI_PLAUSIBILITY_SAMPLE_EDGE, MRI_PLAUSIBILITY_SAMPLE_EDGE), Image.Resampling.BILINEAR)
    rgb = np.asarray(sample, dtype=np.float32)
    channel_spread = rgb.max(axis=2) - rgb.min(axis=2)
    chromatic_fraction = float(np.mean(channel_spread > 18.0))
    if chromatic_fraction > MAX_CHROMATIC_PIXEL_FRACTION:
        raise UploadValidationError(
            "The image is strongly chromatic and could not be verified as a grayscale brain MRI slice."
        )

    luminance = np.asarray(sample.convert("L"), dtype=np.float32)
    low, high = np.percentile(luminance, [5, 95])
    if (
        float(luminance.std()) < MIN_LUMINANCE_STANDARD_DEVIATION
        or float(high - low) < MIN_LUMINANCE_DYNAMIC_RANGE
    ):
        raise UploadValidationError(
            "The image is blank or lacks enough intensity structure for the research MRI classifier."
        )

    border_width = max(1, min(luminance.shape) // 10)
    border = np.concatenate(
        (
            luminance[:border_width, :].ravel(),
            luminance[-border_width:, :].ravel(),
            luminance[:, :border_width].ravel(),
            luminance[:, -border_width:].ravel(),
        )
    )
    dark_threshold = max(24.0, float(high) * 0.15)
    if float(np.mean(border <= dark_threshold)) < MIN_DARK_BORDER_FRACTION:
        raise UploadValidationError(
            "The image does not have the background structure expected from a de-identified brain MRI slice."
        )


def _validate_image(payload: bytes, filename: str, declared_type: str) -> ValidatedUpload:
    if Path(filename).suffix.lower() not in {".png", ".jpg", ".jpeg"}:
        raise UploadValidationError("Classification accepts PNG or JPEG files only.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(payload)) as image:
                pixel_count = image.width * image.height
                if pixel_count > MAX_IMAGE_PIXELS:
                    raise UploadValidationError(f"The image exceeds the {MAX_IMAGE_PIXELS // 1_000_000}-megapixel safety limit.")
                if image.mode not in {"L", "LA", "RGB", "RGBA", "P"}:
                    raise UploadValidationError("The image uses an unsupported channel format for classification.")
                image.verify()
            with Image.open(io.BytesIO(payload)) as image:
                actual = image.format
                _validate_mri_plausibility(image)
    except UploadValidationError:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise UploadValidationError("The uploaded image is corrupted or not a supported image file.") from exc
    if actual not in {"PNG", "JPEG"}:
        raise UploadValidationError("File content does not match a PNG or JPEG image.")
    if declared_type and declared_type not in {"image/png", "image/jpeg", "application/octet-stream"}:
        raise UploadValidationError("The declared MIME type is incompatible with image classification.")
    return ValidatedUpload(filename=filename, media_type=f"image/{actual.lower()}", size_bytes=len(payload))


def _validate_nifti(payload: bytes, filename: str, declared_type: str) -> ValidatedUpload:
    suffixes = "".join(Path(filename).suffixes).lower()
    if suffixes not in {".nii", ".nii.gz"}:
        raise UploadValidationError("Segmentation accepts NIfTI .nii or .nii.gz volumes only.")
    if declared_type and declared_type not in {
        "application/x-nifti",
        "application/nifti",
        "application/gzip",
        "application/octet-stream",
    }:
        raise UploadValidationError("The declared MIME type is incompatible with NIfTI segmentation.")
    try:
        if suffixes == ".nii.gz":
            gzip.GzipFile(fileobj=io.BytesIO(payload)).read(1)
        image = nib.Nifti1Image.from_bytes(payload) if suffixes == ".nii" else nib.load(io.BytesIO(payload))
        if len(image.shape) < 3:
            raise UploadValidationError("NIfTI input must contain a three-dimensional volume.")
    except UploadValidationError:
        raise
    except Exception as exc:
        raise UploadValidationError("The uploaded NIfTI volume is corrupted or incompatible.") from exc
    return ValidatedUpload(filename=filename, media_type="application/x-nifti", size_bytes=len(payload))


def validate_upload(payload: bytes, filename: str, declared_type: str | None, mode: AnalysisMode) -> ValidatedUpload:
    if not payload:
        raise UploadValidationError("The upload is empty.")
    if len(payload) > MAX_UPLOAD_BYTES:
        raise UploadValidationError(f"The upload exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.")
    safe_name = _normalized_name(filename)
    content_type = (declared_type or "").lower().strip()
    if mode is AnalysisMode.CLASSIFICATION:
        return _validate_image(payload, safe_name, content_type)
    return _validate_nifti(payload, safe_name, content_type)
