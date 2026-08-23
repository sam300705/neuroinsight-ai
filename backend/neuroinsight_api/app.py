from __future__ import annotations

import time
import uuid
import os
import logging
from base64 import b64decode
from contextlib import asynccontextmanager
from typing import Protocol

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .constants import ACADEMIC_DISCLAIMER, GLIOMA_SCOPE_DISCLAIMER, MAX_MULTIPART_REQUEST_BYTES, MAX_UPLOAD_BYTES, MODEL_UNAVAILABLE_MESSAGE
from .offline_faq import answer_offline
from .schemas import AnalysisMode, AnalysisResponse, ChatRequest, ChatResponse, Measurement, ModelInfo, ReportRequest
from .reporting import build_report
from .upload_validation import UploadValidationError, validate_upload


logger = logging.getLogger(__name__)


class ClassifierProtocol(Protocol):
    def predict(self, payload: bytes): ...


@asynccontextmanager
async def lifespan(_: FastAPI):
    if os.getenv("USE_ONNX_CLASSIFIER", "false").lower() == "true":
        from .onnx_classifier_runtime import configured_onnx_classifier
        app.state.classifier = configured_onnx_classifier()
    else:
        from .classifier_runtime import configured_classifier
        app.state.classifier = configured_classifier()
    yield


app = FastAPI(
    title="NeuroInsight AI Inference API",
    version="0.1.0",
    description="Academic-use prototype API. It is not a medical diagnostic service.",
    lifespan=lifespan,
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response


@app.exception_handler(UploadValidationError)
async def validation_error_handler(request: Request, exc: UploadValidationError):
    return JSONResponse(status_code=422, content={"request_id": request.headers.get("x-request-id"), "detail": str(exc)})


def _unavailable_result(request: Request, mode: AnalysisMode, started_at: float) -> AnalysisResponse:
    return AnalysisResponse(
        request_id=request.headers.get("x-request-id", "unknown"),
        scan_id=str(uuid.uuid4()),
        mode=mode,
        status="unavailable",
        model_version="unconfigured",
        processing_time_ms=int((time.perf_counter() - started_at) * 1000),
        manual_review_recommended=True,
        measurement=Measurement(
            kind="unavailable",
            metadata_confirmed=False,
            limitation="No segmentation was produced because no verified model artifact is configured.",
        ),
        warnings=[MODEL_UNAVAILABLE_MESSAGE],
        limitations=[ACADEMIC_DISCLAIMER, GLIOMA_SCOPE_DISCLAIMER] if mode is AnalysisMode.SEGMENTATION else [ACADEMIC_DISCLAIMER],
    )


def _classification_result(request: Request, classifier: ClassifierProtocol, payload: bytes, started_at: float) -> AnalysisResponse:
    prediction = classifier.predict(payload)
    return AnalysisResponse(
        request_id=request.headers.get("x-request-id", "unknown"),
        scan_id=str(uuid.uuid4()),
        mode=AnalysisMode.CLASSIFICATION,
        status=prediction.status,
        model_version="bdneuro-v7-resnet50-head-only-exp005",
        processing_time_ms=int((time.perf_counter() - started_at) * 1000),
        predicted_class=prediction.predicted_class,
        model_confidence_score=prediction.confidence,
        calibrated=prediction.calibrated,
        uncertainty_reason=prediction.uncertainty_reason,
        manual_review_recommended=True,
        measurement=Measurement(kind="unavailable", metadata_confirmed=False, limitation="Classification produces no segmentation mask or physical measurement."),
        grad_cam_png_base64=prediction.grad_cam_png_base64,
        warnings=["Experimental image-level academic result. The model confidence score is not a medical probability.", "Qualified radiologist review is required; this system is not a medical diagnosis."],
        limitations=[ACADEMIC_DISCLAIMER, "The experimental classifier was evaluated only on a fixed image-level public split with no patient identifiers. It is not clinically or externally validated.", "Grad-CAM is coarse classifier attribution, not a tumor boundary."],
    )


async def _read_bounded_upload(request: Request, file: UploadFile) -> bytes:
    declared_length = request.headers.get("content-length")
    if declared_length:
        try:
            request_size = int(declared_length)
        except ValueError as exc:
            raise UploadValidationError("The request Content-Length header is invalid.") from exc
        if request_size < 0 or request_size > MAX_MULTIPART_REQUEST_BYTES:
            raise UploadValidationError(f"The upload request exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.")
    try:
        payload = await file.read(MAX_UPLOAD_BYTES + 1)
    finally:
        await file.close()
    if len(payload) > MAX_UPLOAD_BYTES:
        raise UploadValidationError(f"The upload exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.")
    return payload


@app.get("/health")
async def health():
    return {"status": "ok", "service": "neuroinsight-inference"}


@app.get("/ready")
async def ready():
    classifier = getattr(app.state, "classifier", None)
    return {"ready": bool(classifier), "reason": "Experimental classifier configured; academic non-clinical scope only." if classifier else MODEL_UNAVAILABLE_MESSAGE}


@app.get("/api/v1/model-info", response_model=list[ModelInfo])
async def model_info():
    classifier = getattr(app.state, "classifier", None)
    return [
        ModelInfo(
            version="bdneuro-v7-resnet50-head-only-exp005" if classifier else "unconfigured",
            status="available" if classifier else "unavailable",
            mode=AnalysisMode.CLASSIFICATION,
            supported_formats=["image/png", "image/jpeg"],
            scope="Experimental 2D four-class brain MRI image classification; fixed image-level public-split evidence only, not clinical diagnosis",
            calibration_status="validation-only temperature scaling; model confidence score is not a medical probability" if classifier else "not evaluated",
        ),
        ModelInfo(
            version="unconfigured",
            status="unavailable",
            mode=AnalysisMode.SEGMENTATION,
            supported_formats=["application/x-nifti", "application/gzip"],
            scope="glioma-focused compatible NIfTI volume segmentation once a verified model is installed",
            calibration_status="not applicable",
        ),
    ]


@app.post("/api/v1/analyze", response_model=AnalysisResponse)
async def analyze(
    request: Request,
    mode: AnalysisMode = Form(...),
    file: UploadFile = File(...),
):
    started_at = time.perf_counter()
    payload = await _read_bounded_upload(request, file)
    validate_upload(payload, file.filename or "upload", file.content_type, mode)
    if mode is AnalysisMode.CLASSIFICATION and (classifier := getattr(app.state, "classifier", None)):
        return _classification_result(request, classifier, payload, started_at)
    return _unavailable_result(request, mode, started_at)


@app.post("/api/v1/classify", response_model=AnalysisResponse)
async def classify(request: Request, file: UploadFile = File(...)):
    started_at = time.perf_counter()
    payload = await _read_bounded_upload(request, file)
    validate_upload(payload, file.filename or "upload", file.content_type, AnalysisMode.CLASSIFICATION)
    if classifier := getattr(app.state, "classifier", None):
        return _classification_result(request, classifier, payload, started_at)
    return _unavailable_result(request, AnalysisMode.CLASSIFICATION, started_at)


@app.post("/api/v1/segment", response_model=AnalysisResponse)
async def segment(request: Request, file: UploadFile = File(...)):
    started_at = time.perf_counter()
    payload = await _read_bounded_upload(request, file)
    validate_upload(payload, file.filename or "upload", file.content_type, AnalysisMode.SEGMENTATION)
    return _unavailable_result(request, AnalysisMode.SEGMENTATION, started_at)


@app.post("/api/v1/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    return ChatResponse(
        answer=answer_offline(request),
        source="offline_faq",
        safety_notice=ACADEMIC_DISCLAIMER,
    )


@app.post("/api/v1/report")
async def report(request: ReportRequest):
    if request.analysis.mode is not AnalysisMode.CLASSIFICATION:
        raise HTTPException(status_code=422, detail="Mode B reports remain unavailable until a verified full-volume model is released.")
    if request.segmentation_png_base64:
        raise HTTPException(status_code=422, detail="Segmentation overlays cannot be included while Mode B is unavailable.")
    try:
        grad_cam = b64decode(request.grad_cam_png_base64, validate=True) if request.grad_cam_png_base64 else None
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Report image payload must be valid base64.") from exc
    try:
        pdf = build_report(request.analysis, grad_cam)
    except Exception as exc:
        logger.error("report_generation_failed:%s", exc)
        raise HTTPException(status_code=500, detail="The research report could not be generated.") from exc
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="neuroinsight-{request.analysis.scan_id}.pdf"'})


@app.get("/api/v1/unsupported")
async def unsupported():
    raise HTTPException(status_code=501, detail="Model inference and raw-scan persistence remain unavailable until verified deployment artifacts are configured.")
