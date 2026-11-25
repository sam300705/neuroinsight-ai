from __future__ import annotations

import asyncio
import time
import uuid
import os
import logging
import json
import re
from ipaddress import ip_address
from base64 import b64decode
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response

from . import analysis_receipts as receipt_module
from .analysis_receipts import AnalysisReceiptError, issue_analysis_receipt, verify_analysis_receipt
from .constants import ACADEMIC_DISCLAIMER, GLIOMA_SCOPE_DISCLAIMER, MAX_MULTIPART_REQUEST_BYTES, MAX_REPORT_REQUEST_BYTES, MAX_UPLOAD_BYTES, MODEL_UNAVAILABLE_MESSAGE
from .offline_faq import answer_offline
from .rate_limit import FixedWindowRateLimiter
from .distributed_controls import SharedControls, SharedControlUnavailable, SharedReplayDetected
from .inference_execution import InferenceBusyError, inference_concurrency_limiter
from .research_assistant import answer_research_question
from .report_execution import ReportBusyError, report_concurrency_limiter
from .schemas import AnalysisMode, AnalysisResponse, ChatRequest, ChatResponse, Measurement, ModelInfo, ReportRequest, V32Finding
from .reporting import build_report
from .upload_validation import UploadValidationError, validate_upload
from .v32_worker import MODEL_VERSION, WorkerClient, WorkerUnavailable


logger = logging.getLogger(__name__)
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
public_request_limiter = FixedWindowRateLimiter(window_seconds=60, max_requests=20)
assistant_request_limiter = FixedWindowRateLimiter(window_seconds=60, max_requests=10)
shared_controls = SharedControls.from_env()
limited_paths = {"/api/v1/analyze", "/api/v1/classify", "/api/v1/segment", "/api/v1/report", "/api/v1/chat"}
observed_paths = limited_paths | {"/", "/health", "/ready", "/api/v1/model-info", "/api/v1/unsupported"}
upload_paths = {"/api/v1/analyze", "/api/v1/classify", "/api/v1/segment"}
DEFAULT_ALLOWED_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"

DEPLOYMENT_LANDING_PAGE = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#07111f">
  <meta name="description" content="NeuroInsight AI academic inference API deployment status and links.">
  <title>NeuroInsight AI — Vercel deployment</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #07111f; color: #e8f0fb; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: radial-gradient(ellipse at 82% 0%, #14344a 0, #07111f 48rem); }
    main { width: min(960px, calc(100% - 40px)); margin: 0 auto; padding: 58px 0 42px; }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 16px; color: #a8bdd2; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
    .brand { display: flex; align-items: center; gap: 12px; color: #f4f8ff; font-weight: 700; letter-spacing: 0; text-transform: none; font-size: 15px; }
    .mark { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid #39708b; border-radius: 11px; color: #72e0d0; background: #10263a; font-size: 18px; }
    .pill { border: 1px solid #28556a; border-radius: 999px; padding: 8px 12px; color: #8ce8dc; background: #0d2430; font-size: 11px; font-weight: 700; letter-spacing: .09em; }
    .hero { padding: 82px 0 36px; max-width: 760px; }
    .eyebrow { margin: 0 0 16px; color: #70dfd0; font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: 0; color: #f5f8ff; font-size: clamp(38px, 7vw, 68px); line-height: 1.04; letter-spacing: -.045em; }
    .intro { max-width: 670px; margin: 22px 0 0; color: #a9bbce; font-size: 17px; line-height: 1.75; }
    .status { display: flex; align-items: center; gap: 10px; margin-top: 28px; color: #d3e2ef; font-size: 14px; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: #54dfaa; box-shadow: 0 0 14px #54dfaa80; }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 20px; }
    .card { min-height: 132px; padding: 20px; border: 1px solid #20384d; border-radius: 16px; background: linear-gradient(145deg, #102033, #0b1726); }
    .label { color: #8fa6bc; font-size: 12px; text-transform: uppercase; letter-spacing: .1em; }
    .value { margin-top: 13px; color: #f2f7ff; font-size: 17px; font-weight: 650; }
    .hint { margin-top: 7px; color: #91a6bb; font-size: 12px; line-height: 1.5; }
    .links { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
    .link { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border: 1px solid #31516b; border-radius: 10px; color: #e7f2ff; background: #10243a; text-decoration: none; font-size: 14px; font-weight: 600; transition: border-color .15s, transform .15s; }
    .link:hover { border-color: #69d9ce; transform: translateY(-1px); }
    .link.primary { border-color: #65d9cd; color: #06171b; background: #65d9cd; }
    .notice { margin-top: 38px; padding: 18px 20px; border-left: 2px solid #55bdba; border-radius: 0 12px 12px 0; color: #9eb2c6; background: #0c1b2a; font-size: 13px; line-height: 1.65; }
    .notice strong { color: #dce8f4; }
    footer { display: flex; justify-content: space-between; gap: 12px; margin-top: 42px; padding-top: 20px; border-top: 1px solid #1a3044; color: #71879b; font-size: 12px; }
    a:focus-visible { outline: 2px solid #6fe0d3; outline-offset: 3px; }
    @media (max-width: 680px) { main { padding-top: 28px; } .hero { padding-top: 58px; } .cards { grid-template-columns: 1fr; } .card { min-height: 0; } footer { flex-direction: column; } .pill { font-size: 9px; } }
  </style>
</head>
<body>
  <main>
    <div class="top">
      <div class="brand"><span class="mark" aria-hidden="true">N</span><span>NeuroInsight AI</span></div>
      <span class="pill">VERCEL DEPLOYMENT</span>
    </div>
    <section class="hero" aria-labelledby="page-title">
      <p class="eyebrow">Research inference service</p>
      <h1 id="page-title">Deployed and responding.</h1>
      <p class="intro">This Vercel deployment serves the NeuroInsight AI FastAPI backend. Use the links below to inspect the API, verify its health, or open the separate project dashboard.</p>
      <div class="status"><span class="dot" aria-hidden="true"></span><span id="health-status" role="status">Checking live API health…</span></div>
    </section>
    <section class="cards" aria-label="Deployment information">
      <article class="card"><div class="label">Deployment</div><div class="value">Vercel · FastAPI</div><div class="hint">Public API endpoint for the academic demo.</div></article>
      <article class="card"><div class="label">Inference worker</div><div class="value" id="ready-status">Checking readiness…</div><div class="hint">Readiness is reported separately from API availability.</div></article>
      <article class="card"><div class="label">Scope</div><div class="value">Academic research demo</div><div class="hint">Not a medical device or diagnostic service.</div></article>
    </section>
    <nav class="links" aria-label="Project links">
      <a class="link primary" href="/docs">Explore API documentation <span aria-hidden="true">&nbsp;→</span></a>
      <a class="link" href="/health">Health endpoint</a>
      <a class="link" href="https://github.com/sam300705/neuroinsight-ai" target="_blank" rel="noopener noreferrer">GitHub source ↗</a>
      <a class="link" href="https://neuroaiapp-gtbxy6cw.manus.space" target="_blank" rel="noopener noreferrer">Open project dashboard ↗</a>
    </nav>
    <aside class="notice"><strong>Research-use disclaimer.</strong> NeuroInsight AI is an experimental academic demonstration. It is not a medical diagnosis and must not replace assessment by a qualified radiologist. The Vercel service is the API; the interactive dashboard is hosted separately.</aside>
    <footer><span>NeuroInsight AI · inference API</span><span>Live status is checked from this deployment.</span></footer>
  </main>
  <script>
    async function updateServiceStatus() {
      const health = document.getElementById('health-status');
      const readiness = document.getElementById('ready-status');
      try {
        const response = await fetch('/health', { cache: 'no-store' });
        const data = await response.json();
        health.textContent = response.ok && data.status === 'ok' ? 'API is online · health check passed' : 'API health check returned an issue';
      } catch (_) {
        health.textContent = 'API health check could not be reached';
      }
      try {
        const response = await fetch('/ready', { cache: 'no-store' });
        const data = await response.json();
        readiness.textContent = data.ready ? 'Worker ready' : 'Worker not configured';
      } catch (_) {
        readiness.textContent = 'Readiness unavailable';
      }
    }
    updateServiceStatus();
  </script>
</body>
</html>"""


def _apply_operational_headers(response: Response) -> Response:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


def _request_id_for(request: Request) -> str:
    existing = getattr(request.state, "request_id", None)
    if existing:
        return existing
    supplied_id = request.headers.get("x-request-id")
    request_id = supplied_id if supplied_id and REQUEST_ID_PATTERN.fullmatch(supplied_id) else str(uuid.uuid4())
    request.state.request_id = request_id
    return request_id


def _rate_limit_identity(request: Request) -> str:
    """Use Vercel's overwritten client-IP header only inside a declared Vercel runtime."""
    peer = request.client.host if request.client else "unknown"
    if os.getenv("VERCEL", "").strip() != "1":
        return peer
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    try:
        return str(ip_address(forwarded))
    except ValueError:
        return peer


def _configured_allowed_origins(raw_origins: str | None = None) -> list[str]:
    """Return exact, safe browser origins or fail closed on misconfiguration."""
    configured = os.getenv("CORS_ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS) if raw_origins is None else raw_origins
    allowed: list[str] = []
    for candidate in configured.split(","):
        origin = candidate.strip()
        if not origin:
            continue
        try:
            parsed = urlsplit(origin)
            port = parsed.port
        except ValueError as exc:
            raise RuntimeError("CORS_ALLOWED_ORIGINS contains an invalid origin.") from exc
        is_loopback = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
        is_safe_scheme = parsed.scheme == "https" or (parsed.scheme == "http" and is_loopback)
        if (
            origin == "*"
            or not parsed.hostname
            or not is_safe_scheme
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path
            or parsed.query
            or parsed.fragment
            or (port is not None and not 1 <= port <= 65535)
        ):
            raise RuntimeError("CORS_ALLOWED_ORIGINS must contain only exact HTTPS origins or loopback HTTP origins.")
        if origin not in allowed:
            allowed.append(origin)
    return allowed


@asynccontextmanager
async def lifespan(_: FastAPI):
    path = os.getenv("NEUROINSIGHT_V32_SOCKET")
    app.state.classifier = WorkerClient(Path(path)) if path else None
    try:
        yield
    finally:
        app.state.classifier = None


app = FastAPI(
    title="NeuroInsight AI Inference API",
    version="0.1.0",
    description="Academic-use prototype API. It is not a medical diagnostic service.",
    lifespan=lifespan,
)

allowed_origins = _configured_allowed_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = _request_id_for(request)
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response


@app.middleware("http")
async def public_demo_rate_limit_middleware(request: Request, call_next):
    if request.method == "POST" and request.url.path in upload_paths:
        declared_length = request.headers.get("content-length")
        if declared_length:
            request_id = _request_id_for(request)
            try:
                request_size = int(declared_length)
            except ValueError:
                return JSONResponse(
                    status_code=422,
                    content={"request_id": request_id, "detail": "The request Content-Length header is invalid."},
                    headers={"x-request-id": request_id},
                )
            if request_size < 0 or request_size > MAX_MULTIPART_REQUEST_BYTES:
                return JSONResponse(
                    status_code=422,
                    content={
                        "request_id": request_id,
                        "detail": f"The upload request exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
                    },
                    headers={"x-request-id": request_id},
                )
    if request.method == "POST" and request.url.path == "/api/v1/report":
        declared_length = request.headers.get("content-length")
        if declared_length:
            request_id = _request_id_for(request)
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
        client_identity = _rate_limit_identity(request)
        limiter = assistant_request_limiter if request.url.path == "/api/v1/chat" else public_request_limiter
        try:
            allowed, retry_after = await shared_controls.allow(
                scope="assistant" if request.url.path == "/api/v1/chat" else "public",
                identity=f"{request.url.path}:{client_identity}",
                window_seconds=limiter.window_seconds,
                max_requests=limiter.max_requests,
                local_fallback=lambda: limiter.allow(f"{request.url.path}:{client_identity}"),
            )
        except SharedControlUnavailable:
            request_id = _request_id_for(request)
            return JSONResponse(
                status_code=503,
                content={"request_id": request_id, "detail": "Shared abuse controls are unavailable; please retry later."},
                headers={"Retry-After": "5", "x-request-id": request_id},
            )
        if not allowed:
            request_id = _request_id_for(request)
            return JSONResponse(
                status_code=429,
                content={"request_id": request_id, "detail": "Public demo request limit reached. Please retry later."},
                headers={"Retry-After": str(retry_after), "x-request-id": request_id},
            )
    return await call_next(request)


@app.middleware("http")
async def operational_response_middleware(request: Request, call_next):
    """Emit bounded request events and prevent caching of derived research data."""
    started_at = time.perf_counter()
    route = request.url.path if request.url.path in observed_paths else "other"
    try:
        response = await call_next(request)
    except Exception as exc:
        logger.error(json.dumps({
            "level": "error",
            "event": "request_failed",
            "route": route,
            "method": request.method,
            "status": 500,
            "duration_ms": int((time.perf_counter() - started_at) * 1000),
            "request_id": getattr(request.state, "request_id", "unknown"),
            "error_type": type(exc).__name__,
        }, separators=(",", ":"), sort_keys=True))
        request_id = getattr(request.state, "request_id", "unknown")
        return _apply_operational_headers(JSONResponse(
            status_code=500,
            content={"request_id": request_id, "detail": "The inference service encountered an internal error."},
            headers={"x-request-id": request_id},
        ))
    _apply_operational_headers(response)
    logger.info(json.dumps({
        "level": "info",
        "event": "request_completed",
        "route": route,
        "method": request.method,
        "status": response.status_code,
        "duration_ms": int((time.perf_counter() - started_at) * 1000),
        "request_id": getattr(request.state, "request_id", response.headers.get("x-request-id", "unknown")),
    }, separators=(",", ":"), sort_keys=True))
    return response


@app.exception_handler(UploadValidationError)
async def validation_error_handler(request: Request, exc: UploadValidationError):
    return JSONResponse(status_code=422, content={"request_id": getattr(request.state, "request_id", None), "detail": str(exc)})


@app.exception_handler(InferenceBusyError)
async def inference_busy_handler(request: Request, _: InferenceBusyError):
    request_id = getattr(request.state, "request_id", "unknown")
    return JSONResponse(
        status_code=503,
        content={"request_id": request_id, "detail": "Inference capacity is busy; please retry shortly."},
        headers={"Retry-After": "2", "x-request-id": request_id},
    )


@app.exception_handler(ReportBusyError)
async def report_busy_handler(request: Request, _: ReportBusyError):
    request_id = getattr(request.state, "request_id", "unknown")
    return JSONResponse(
        status_code=503,
        content={"request_id": request_id, "detail": "Report capacity is busy; please retry shortly."},
        headers={"Retry-After": "2", "x-request-id": request_id},
    )


def _unavailable_result(request: Request, mode: AnalysisMode, started_at: float) -> AnalysisResponse:
    return AnalysisResponse(
        request_id=getattr(request.state, "request_id", "unknown"),
        scan_id=str(uuid.uuid4()),
        mode=mode,
        status="unavailable",
        model_version=MODEL_VERSION if mode is AnalysisMode.CLASSIFICATION else "unconfigured",
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


def _validate_and_predict(
    classifier: WorkerClient,
    payload: bytes,
    filename: str,
    content_type: str | None,
):
    validate_upload(payload, filename, content_type, AnalysisMode.CLASSIFICATION)
    return classifier.predict(payload)


async def _classification_result(
    request: Request,
    classifier: WorkerClient,
    payload: bytes,
    filename: str,
    content_type: str | None,
    started_at: float,
) -> AnalysisResponse:
    try:
        prediction = await inference_concurrency_limiter.run(
            _validate_and_predict, classifier, payload, filename, content_type,
        )
    except WorkerUnavailable:
        return _unavailable_result(request, AnalysisMode.CLASSIFICATION, started_at)
    has_mask = bool(prediction["mask_png_base64"])
    finding = V32Finding.model_validate({
        **prediction,
        "tumor_area_px": prediction["tumor_area_px"] if has_mask else None,
        "tumor_pct_of_image": prediction["tumor_pct_of_image"] if has_mask else None,
        "tumor_pct_of_brain": prediction["tumor_pct_of_brain"] if has_mask else None,
    })
    low_confidence = any(reason.startswith("low classifier confidence:") for reason in finding.review_reasons)
    analysis = AnalysisResponse(
        request_id=getattr(request.state, "request_id", "unknown"),
        scan_id=str(uuid.uuid4()),
        mode=AnalysisMode.CLASSIFICATION,
        status="low_confidence" if low_confidence else "complete",
        model_version=MODEL_VERSION,
        processing_time_ms=int((time.perf_counter() - started_at) * 1000),
        predicted_class=finding.classifier_class,
        model_confidence_score=finding.confidence,
        calibrated=True,
        uncertainty_reason="; ".join(finding.review_reasons) or None,
        manual_review_recommended=True,
        measurement=Measurement(
            kind="relative_area" if has_mask else "unavailable",
            pixel_count=finding.tumor_area_px,
            occupancy_percent=finding.tumor_pct_of_image,
            metadata_confirmed=False,
            limitation="Predicted 2D outline in source-image pixels; no physical measurement."
            if has_mask else "No predicted outline is available for a 2D area estimate.",
        ),
        finding=finding,
        grad_cam_png_base64=prediction["gradcam_png_base64"],
        warnings=[ACADEMIC_DISCLAIMER],
        limitations=[
            "Classifier confidence describes the four-way classifier decision.",
            "The predicted outline is an experimental 2D output. Physical measurements and volumetric Mode B are unavailable.",
        ],
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


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def deployment_homepage():
    return HTMLResponse(DEPLOYMENT_LANDING_PAGE)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "neuroinsight-inference"}


@app.get("/ready")
async def ready():
    classifier = getattr(app.state, "classifier", None)
    worker_ready = bool(classifier) and await asyncio.to_thread(classifier.ready)
    ready_now = worker_ready and shared_controls.ready
    if not worker_ready:
        reason = MODEL_UNAVAILABLE_MESSAGE
    elif not shared_controls.ready:
        reason = "Required shared abuse and replay controls are not configured."
    else:
        reason = "Experimental v3.2 pipeline configured; academic non-clinical scope only."
    payload = {"ready": ready_now, "reason": reason}
    return payload if ready_now else JSONResponse(status_code=503, content=payload)


@app.get("/api/v1/model-info", response_model=list[ModelInfo])
async def model_info():
    classifier = getattr(app.state, "classifier", None)
    worker_ready = bool(classifier) and await asyncio.to_thread(classifier.ready)
    return [
        ModelInfo(
            version=MODEL_VERSION,
            status="available" if worker_ready else "unavailable",
            mode=AnalysisMode.CLASSIFICATION,
            supported_formats=["image/png", "image/jpeg"],
            scope="Experimental 2D brain MRI classification and predicted outline; academic research only",
            calibration_status="v3.2 EfficientNetV2-S classifier temperature 0.605; classifier confidence only",
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
    filename = file.filename or "upload"
    content_type = file.content_type
    payload = await _read_bounded_upload(request, file)
    if mode is AnalysisMode.CLASSIFICATION and (classifier := getattr(app.state, "classifier", None)):
        return await _classification_result(request, classifier, payload, filename, content_type, started_at)
    await inference_concurrency_limiter.run(validate_upload, payload, filename, content_type, mode)
    return _unavailable_result(request, mode, started_at)


@app.post("/api/v1/classify", response_model=AnalysisResponse)
async def classify(request: Request, file: UploadFile = File(...)):
    started_at = time.perf_counter()
    filename = file.filename or "upload"
    content_type = file.content_type
    payload = await _read_bounded_upload(request, file)
    if classifier := getattr(app.state, "classifier", None):
        return await _classification_result(request, classifier, payload, filename, content_type, started_at)
    await inference_concurrency_limiter.run(
        validate_upload,
        payload,
        filename,
        content_type,
        AnalysisMode.CLASSIFICATION,
    )
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
    async with report_concurrency_limiter.slot():
        try:
            grad_cam = await asyncio.to_thread(b64decode, request.grad_cam_png_base64, validate=True) if request.grad_cam_png_base64 else None
            mask = await asyncio.to_thread(b64decode, request.segmentation_png_base64, validate=True) if request.segmentation_png_base64 else None
        except Exception as exc:
            raise HTTPException(status_code=422, detail="Report image payload must be valid base64.") from exc
        try:
            current_time = int(time.time())
            verified_receipt = verify_analysis_receipt(request.analysis_receipt, grad_cam, mask=mask, now=current_time)
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
            if mask is None:
                pdf = await asyncio.to_thread(build_report, verified_receipt.analysis, grad_cam)
            else:
                pdf = await asyncio.to_thread(build_report, verified_receipt.analysis, grad_cam, mask)
        except Exception as exc:
            logger.error("report_generation_failed:error_type=%s", type(exc).__name__)
            raise HTTPException(status_code=500, detail="The research report could not be generated.") from exc
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="neuroinsight-{verified_receipt.analysis.scan_id}.pdf"'})


@app.get("/api/v1/unsupported")
async def unsupported():
    raise HTTPException(status_code=501, detail="Model inference and raw-scan persistence remain unavailable until verified deployment artifacts are configured.")
