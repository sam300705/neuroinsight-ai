from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AnalysisMode(str, Enum):
    CLASSIFICATION = "classification"
    SEGMENTATION = "segmentation"


class Measurement(BaseModel):
    kind: Literal["unavailable", "relative_area", "physical_area", "physical_volume"]
    pixel_count: int | None = Field(default=None, ge=0)
    voxel_count: int | None = Field(default=None, ge=0)
    occupancy_percent: float | None = Field(default=None, ge=0, le=100)
    value: float | None = Field(default=None, ge=0)
    unit: Literal["pixels", "voxels", "percent", "mm²", "mL"] | None = None
    metadata_confirmed: bool
    limitation: str


class ModelInfo(BaseModel):
    version: str
    status: Literal["available", "unavailable"]
    mode: AnalysisMode
    supported_formats: list[str]
    scope: str
    calibration_status: str


class AnalysisResponse(BaseModel):
    request_id: str
    scan_id: str
    mode: AnalysisMode
    status: Literal["complete", "low_confidence", "incompatible", "partial", "unavailable"]
    model_version: str
    processing_time_ms: int = Field(ge=0)
    predicted_class: Literal["glioma", "meningioma", "pituitary", "no_tumor"] | None = None
    model_confidence_score: float | None = Field(default=None, ge=0, le=1)
    calibrated: bool = False
    uncertainty_reason: str | None = None
    manual_review_recommended: bool
    measurement: Measurement
    grad_cam_url: str | None = None
    grad_cam_png_base64: str | None = Field(default=None, max_length=14_000_000)
    segmentation_mask_url: str | None = None
    warnings: list[str]
    limitations: list[str]


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(min_length=1, max_length=600)
    language: Literal["en", "hi"] = "en"
    purpose: Literal["question", "result_summary"] = "question"
    predicted_class: Literal["glioma", "meningioma", "pituitary", "no_tumor"] | None = None
    model_version: Literal["bdneuro-v7-resnet50-head-only-exp005"] | None = None
    model_confidence_score: float | None = Field(default=None, ge=0, le=1)
    calibrated: bool = False
    manual_review_recommended: bool = True
    grad_cam_available: bool = False
    uncertainty_reason: str | None = None
    measurement_available: bool = False


class ChatResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answer: str = Field(min_length=1, max_length=1_200)
    source: Literal["offline_faq", "openai", "gemini"]
    category: Literal["model_explanation", "calibration", "abstention", "grad_cam", "mode_boundary", "methodology", "report", "general", "refusal"]
    medical_advice_refused: bool
    manual_review_reminder: bool
    disclaimer_required: bool
    safety_notice: str


class ReportRequest(BaseModel):
    analysis: AnalysisResponse
    grad_cam_png_base64: str | None = Field(default=None, max_length=14_000_000)
    segmentation_png_base64: str | None = Field(default=None, max_length=14_000_000)
