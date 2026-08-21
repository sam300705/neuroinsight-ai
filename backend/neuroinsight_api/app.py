from __future__ import annotations

import time
import uuid
from base64 import b64decode
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, Response

from .constants import ACADEMIC_DISCLAIMER, GLIOMA_SCOPE_DISCLAIMER, MODEL_UNAVAILABLE_MESSAGE
from .offline_faq import answer_offline
from .schemas import AnalysisMode, AnalysisResponse, ChatRequest, ChatResponse, Measurement, ModelInfo, ReportRequest
from .reporting import build_report
from .upload_validation import UploadValidationError, validate_upload


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Model initialization belongs here once licensed, verified artifact paths exist.
    yield


app = FastAPI(
    title="NeuroInsight AI Inference API",
    version="0.1.0",
    description="Academic-use prototype API. It is not a medical diagnostic service.",
    lifespan=lifespan,
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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "neuroinsight-inference"}


@app.get("/ready")
async def ready():
    return {"ready": False, "reason": MODEL_UNAVAILABLE_MESSAGE}


@app.get("/api/v1/model-info", response_model=list[ModelInfo])
async def model_info():
    return [
        ModelInfo(
            version="unconfigured",
            status="unavailable",
            mode=AnalysisMode.CLASSIFICATION,
            supported_formats=["image/png", "image/jpeg"],
            scope="2D four-class brain MRI classification once a verified model is installed",
            calibration_status="not evaluated",
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
    payload = await file.read()
    validate_upload(payload, file.filename or "upload", file.content_type, mode)
    return _unavailable_result(request, mode, started_at)


@app.post("/api/v1/classify", response_model=AnalysisResponse)
async def classify(request: Request, file: UploadFile = File(...)):
    started_at = time.perf_counter()
    payload = await file.read()
    validate_upload(payload, file.filename or "upload", file.content_type, AnalysisMode.CLASSIFICATION)
    return _unavailable_result(request, AnalysisMode.CLASSIFICATION, started_at)


@app.post("/api/v1/segment", response_model=AnalysisResponse)
async def segment(request: Request, file: UploadFile = File(...)):
    started_at = time.perf_counter()
    payload = await file.read()
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
    try:
        grad_cam = b64decode(request.grad_cam_png_base64, validate=True) if request.grad_cam_png_base64 else None
        segmentation = b64decode(request.segmentation_png_base64, validate=True) if request.segmentation_png_base64 else None
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Report image payload must be valid base64.") from exc
    pdf = build_report(request.analysis, grad_cam, segmentation)
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="neuroinsight-{request.analysis.scan_id}.pdf"'})


@app.get("/api/v1/unsupported")
async def unsupported():
    raise HTTPException(status_code=501, detail="Model inference and raw-scan persistence remain unavailable until verified deployment artifacts are configured.")
