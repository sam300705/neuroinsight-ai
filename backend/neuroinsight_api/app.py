from __future__ import annotations

import time
import uuid
import os
import logging
import re
from base64 import b64decode
from contextlib import asynccontextmanager
from typing import Protocol

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from . import analysis_receipts as receipt_module
from .analysis_receipts import AnalysisReceiptError, issue_analysis_receipt, verify_analysis_receipt
from .constants import ACADEMIC_DISCLAIMER, GLIOMA_SCOPE_DISCLAIMER, MAX_MULTIPART_REQUEST_BYTES, MAX_REPORT_REQUEST_BYTES, MAX_UPLOAD_BYTES, MODEL_UNAVAILABLE_MESSAGE
from .offline_faq import answer_offline
from .rate_limit import FixedWindowRateLimiter
from .distributed_controls import SharedControls, SharedControlUnavailable, SharedReplayDetected
from .research_assistant import answer_research_question
from .schemas import AnalysisMode, AnalysisResponse, ChatRequest, ChatResponse, Measurement, ModelInfo, ReportRequest
from .reporting import build_report
from .upload_validation import UploadValidationError, validate_upload


logger = logging.getLogger(__name__)
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
public_request_limiter = FixedWindowRateLimiter(window_seconds=60, max_requests=20)
assistant_request_limiter = FixedWindowRateLimiter(window_seconds=60, max_requests=10)
shared_controls = SharedControls.from_env()
limited_paths = {"/api/v1/analyze", "/api/v1/classify", "/api/v1/segment", "/api/v1/report", "/api/v1/chat"}


class ClassifierProtocol(Protocol):
    def predict(self, payload: bytes): ...


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        if os.getenv("USE_ONNX_CLASSIFIER", "false").lower() == "true":
            from .onnx_classifier_runtime import configured_onnx_classifier
            app.state.classifier = configured_onnx_classifier()
        else:
            from .classifier_runtime import configured_classifier
            app.state.classifier = configured_classifier()
    except Exception as exc:
        # A transient artifact, checksum, metadata, or runtime failure must not
        # turn a public research preview into a generic server error. The API
        # remains available but reports the classifier as unavailable.
        logger.error(
            "classifier_initialization_failed:category=%s:error_type=%s",
            getattr(exc, "category", "unknown"),
            type(exc).__name__,
        )
        app.state.classifier = None
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
    supplied_id = request.headers.get("x-request-id")
    request_id = supplied_id if supplied_id and REQUEST_ID_PATTERN.fullmatch(supplied_id) else str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response


@app.middleware("http")
async def public_demo_rate_limit_middleware(request: Request, call_next):
    if request.method == "POST" and request.url.path == "/api/v1/report":
        declared_length = request.headers.get("content-length")
        if declared_length:
            request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
            try:
                request_size = int(declared_length)
            except ValueError:
                return JSONResponse(
                    status_code=422,
                    content={"request_id": request_id, "detail": "The report Content-Length header is invalid."},
                    headers={"x-request-id": request_id},
                )
            if request_size < 0 or request_size > MAX_REPORT_REQUEST_BYTES:
                return JSONResponse(
                    status_code=422,
                    content={"request_id": request_id, "detail": "The report request exceeds the 15 MB limit."},
                    headers={"x-request-id": request_id},
                )
    if request.method == "POST" and request.url.path in limited_paths:
        client_host = request.client.host if request.client else "unknown"
        limiter = assistant_request_limiter if request.url.path == "/api/v1/chat" else public_request_limiter
        try:
            allowed, retry_after = await shared_controls.allow(
                scope="assistant" if request.url.path == "/api/v1/chat" else "public",
                identity=f"{request.url.path}:{client_host}",
                window_seconds=limiter.window_seconds,
                max_requests=limiter.max_requests,
                local_fallback=lambda: limiter.allow(f"{request.url.path}:{client_host}"),
            )
        except SharedControlUnavailable:
            request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
            return JSONResponse(
                status_code=503,
                content={"request_id": request_id, "detail": "Shared abuse controls are unavailable; please retry later."},
                headers={"Retry-After": "5", "x-request-id": request_id},
            )
        if not allowed:
            request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
            request.state.request_id = request_id
            return JSONResponse(
                status_code=429,
                content={"request_id": request_id, "detail": "Public demo request limit reached. Please retry later."},
                headers={"Retry-After": str(retry_after), "x-request-id": request_id},
            )
    return await call_next(request)


@app.exception_handler(UploadValidationError)
async def validation_error_handler(request: Request, exc: UploadValidationError):
    return JSONResponse(status_code=422, content={"request_id": getattr(request.state, "request_id", None), "detail": str(exc)})


def _unavailable_result(request: Request, mode: AnalysisMode, started_at: float) -> AnalysisResponse:
    return AnalysisResponse(
        request_id=getattr(request.state, "request_id", "unknown"),
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
    analysis = AnalysisResponse(
        request_id=getattr(request.state, "request_id", "unknown"),
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
    return analysis.model_copy(update={"analysis_receipt": issue_analysis_receipt(analysis)})


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
    ready_now = bool(classifier) and shared_controls.ready
    if not classifier:
        reason = MODEL_UNAVAILABLE_MESSAGE
    elif not shared_controls.ready:
        reason = "Required shared abuse and replay controls are not configured."
    else:
        reason = "Experimental classifier configured; academic non-clinical scope only."
    payload = {"ready": ready_now, "reason": reason}
    return payload if ready_now else JSONResponse(status_code=503, content=payload)


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
    if mode is AnalysisMode.SEGMENTATION:
        await file.close()
        return _unavailable_result(request, mode, started_at)
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
    await file.close()
    return _unavailable_result(request, AnalysisMode.SEGMENTATION, started_at)


@app.post("/api/v1/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, http_request: Request):
    started_at = time.perf_counter()
    reply = await answer_research_question(request)
    logger.info(
        "assistant_event provider=%s outcome=%s category=%s latency_ms=%d request_id=%s",
        reply.attempted_provider,
        "refused" if reply.medical_advice_refused else ("fallback" if reply.source == "offline_faq" else "answered"),
        reply.category,
        int((time.perf_counter() - started_at) * 1000),
        getattr(http_request.state, "request_id", "unknown"),
    )
    return ChatResponse(
        answer=reply.answer,
        source=reply.source,
        category=reply.category,
        medical_advice_refused=reply.medical_advice_refused,
        manual_review_reminder=reply.manual_review_reminder,
        disclaimer_required=reply.disclaimer_required,
        safety_notice=ACADEMIC_DISCLAIMER,
    )


@app.post("/api/v1/report")
async def report(request: ReportRequest):
    if request.segmentation_png_base64:
        raise HTTPException(status_code=422, detail="Segmentation overlays cannot be included while Mode B is unavailable.")
    try:
        grad_cam = b64decode(request.grad_cam_png_base64, validate=True) if request.grad_cam_png_base64 else None
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Report image payload must be valid base64.") from exc
    try:
        current_time = int(time.time())
        verified_receipt = verify_analysis_receipt(request.analysis_receipt, grad_cam, now=current_time)
        try:
            await shared_controls.consume_receipt_once(
                receipt_id=verified_receipt.receipt_id,
                expires_at=verified_receipt.expires_at,
                now=current_time,
                local_fallback=lambda: receipt_module.receipt_replay_guard.consume_once(
                    verified_receipt.receipt_id, verified_receipt.expires_at, current_time
                ),
            )
        except SharedReplayDetected as exc:
            raise AnalysisReceiptError("replayed") from exc
        except SharedControlUnavailable as exc:
            raise AnalysisReceiptError("replay_guard_unavailable") from exc
    except AnalysisReceiptError as exc:
        if exc.category == "signing_unavailable":
            raise HTTPException(status_code=503, detail="Report integrity signing is not configured; report generation is unavailable.") from exc
        if exc.category == "replayed":
            raise HTTPException(status_code=409, detail="This report receipt has already been used; generate a fresh analysis result.") from exc
        if exc.category == "replay_guard_unavailable":
            raise HTTPException(status_code=503, detail="Shared report replay protection is unavailable; report generation is temporarily disabled.") from exc
        raise HTTPException(status_code=422, detail="The report receipt is invalid, expired, or does not match the server-issued Mode A analysis.") from exc
    try:
        pdf = build_report(verified_receipt.analysis, grad_cam)
    except Exception as exc:
        logger.error("report_generation_failed:%s", exc)
        raise HTTPException(status_code=500, detail="The research report could not be generated.") from exc
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="neuroinsight-{verified_receipt.analysis.scan_id}.pdf"'})


@app.get("/api/v1/unsupported")
async def unsupported():
    raise HTTPException(status_code=501, detail="Model inference and raw-scan persistence remain unavailable until verified deployment artifacts are configured.")
