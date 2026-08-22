# Deployment Handover

The managed Node dashboard and the Python validation service are intentionally deployable as **separate components**. This keeps the dashboard compatible with managed hosting while isolating the scientific Python runtime. The project deliberately does **not** package exploratory model weights into either component.

| Component | Packaging state | Operational boundary |
|---|---|---|
| React + tRPC dashboard | Managed Node application | It can be published from the project interface after review of a saved checkpoint. |
| Scan metadata and derived artifact references | Managed database plus preconfigured object storage | History procedures require an authenticated account; ownership is checked before a fresh signed download URL is issued for a derived artifact. Raw scans are not persisted. |
| FastAPI validation/report service | Vercel FastAPI function using ONNX Runtime | A separate HTTPS service performs configured Mode A experimental inference and generates derived PDF reports. Mode B remains unavailable. |
| Experimental classification checkpoint and calibration metadata | External to the repository and Vercel function bundle | SHA-256-verified HTTPS retrieval is used at runtime. Raw MRI data and weights are not committed to Git. |

## Dashboard configuration

The browser calls the independent validation service only when `VITE_INFERENCE_API_BASE_URL` is configured at dashboard build time. The value must be an HTTPS base URL without `/api/v1/analyze`; for example, `https://validation.example.org`. The Python service must set `CORS_ALLOWED_ORIGINS` to the exact comma-separated dashboard origins permitted to call it. If the dashboard variable is absent, the dashboard does not upload the scan and explicitly reports that server-side validation has not been configured.

> Do not expose raw scans to a third party without a documented data-processing, privacy, and security review. The current service is an academic prototype, not a medical diagnostic deployment.

## Local FastAPI validation service

For local development without containers, install the service package from `backend/` and run its tests through the installed package:

```bash
cd backend
python3 -m pip install -e '.[test]'
pytest -q
uvicorn neuroinsight_api.app:app --host 127.0.0.1 --port 8000
```

The included Compose asset supports an isolated local service:

```bash
cd backend
docker compose up --build
```

The local container intentionally contains no model weight files. In the verified external service, the ONNX model, metadata, and validation calibration file are fetched over HTTPS with fixed SHA-256 verification. Neither configuration makes a medical or clinical claim.

## Smoke-test procedure

| Step | Command or action | Expected evidence |
|---|---|---|
| Health endpoint | `curl -fsS https://<verified-service>/health` | `status: ok` and the service identifier. |
| Readiness endpoint | `curl -fsS https://<verified-service>/ready` | `ready: true` only when the experimental ONNX classifier initialized successfully. |
| Model information | `curl -fsS https://<verified-service>/api/v1/model-info` | Mode A marked `available`; Mode B explicitly `unavailable`. |
| Corrupted upload | POST a deliberately malformed PNG or JPEG to `/api/v1/classify` | HTTP `422`; no simulated prediction is returned. |
| Valid public research image | Submit one lawful, non-sensitive fixed-split public JPEG or PNG | HTTP `200` with the actual experimental class, model confidence score, calibrated state, Grad-CAM payload, and mandatory non-clinical warnings. This is image-level experimental evidence only. |
| Derived report | POST that returned analysis and Grad-CAM payload to `/api/v1/report` | A valid `%PDF` document containing the returned metadata and real Grad-CAM attribution; no raw MRI is embedded or stored by the dashboard. |
| Dashboard integration | Set `VITE_INFERENCE_API_BASE_URL`, restart the managed dashboard, and upload the same file | The UI surfaces the authoritative response. Authenticated users can consent to save metadata, the derived PDF, and Grad-CAM to protected history; the original MRI upload is not saved. |

## Publication boundary

## Vercel academic-demo backend attempt

An authorized Vercel deployment of `backend/` was created from the private repository on 2026-08-22. The first build failed because default PyTorch dependencies produced a **4,658.61 MB** Python function bundle, exceeding Vercel’s reported **500 MB** maximum. A CPU-only PyTorch attempt reduced this to 794.41 MB but still exceeded the limit. The deployment path therefore changed to ONNX Runtime.

The final ONNX deployment passed HTTPS health and readiness, exact-preview-origin CORS preflight, malformed-upload rejection, actual inference on one lawful public fixed-split test image, and a two-page PDF report generated from that response and real Grad-CAM. An early report-route failure was isolated to the external FPDF layout behavior and corrected using explicit paragraph widths. The output from the public glioma-labelled test image was **meningioma** with model confidence score `0.825931191444397`; this incorrect result is retained as evidence of an experimental, non-diagnostic system rather than being hidden or treated as clinical performance.

The selected experimental checkpoint remains outside Git and raw MRI datasets are not uploaded. The Vercel entry point can retrieve only the published checkpoint and calibration JSON through HTTPS and checks their fixed SHA-256 values before loading. It preserves the academic, non-diagnostic boundary in every response.

To publish the current managed dashboard, create and review a checkpoint, then use the project interface’s **Publish** control. After publication, add that final public dashboard HTTPS origin to the Vercel CORS allowlist alongside localhost development origins, re-verify preflight, and publish a new backend deployment. Publication does not make the experimental model clinically valid and must retain the persistent notice: **“This system is not a medical diagnosis and must not replace a qualified radiologist.”**
