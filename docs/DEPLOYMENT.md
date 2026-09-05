# Deployment Handover

The managed Node dashboard and the Python validation service are intentionally deployable as **separate components**. This keeps the dashboard compatible with managed hosting while isolating the scientific Python runtime. The project deliberately does **not** package exploratory model weights into either component.

| Component | Packaging state | Operational boundary |
|---|---|---|
| React + tRPC dashboard | Managed Node application | It can be published from the project interface after review of a saved checkpoint. |
| Scan metadata and derived artifact references | Managed database plus preconfigured object storage | History procedures require an authenticated account; ownership is checked before a fresh signed download URL is issued for a derived Mode A report or Grad-CAM. Raw scans are not persisted. |
| FastAPI validation/report service | Vercel FastAPI function using ONNX Runtime | A separate HTTPS service performs configured Mode A experimental inference. In the current PR, derived PDF reports additionally require a valid server-issued receipt and owner-controlled signing configuration. Mode B remains unavailable. |
| Experimental classification checkpoint and calibration metadata | External to the repository and Vercel function bundle | SHA-256-verified HTTPS retrieval is used at runtime. Raw MRI data and weights are not committed to Git. |

## Dashboard configuration

The browser calls the independent validation service only when `VITE_INFERENCE_API_BASE_URL` is configured at dashboard build time. The value must be an HTTPS base URL without `/api/v1/analyze`; for example, `https://validation.example.org`. The Python service must set `CORS_ALLOWED_ORIGINS` to the exact comma-separated dashboard origins permitted to call it and must configure the documented checksum-verified ONNX variables in `docs/ENVIRONMENT.md`. If the dashboard variable is absent, the dashboard does not upload the scan and explicitly reports that server-side validation has not been configured.

> Do not expose raw scans to a third party without a documented data-processing, privacy, and security review. The current service is an academic prototype, not a medical diagnostic deployment.

The dashboard process validates `PORT` as an integer from 1 through 65535. In production it also requires a non-empty platform application identity in `VITE_APP_ID` and a server-only `JWT_SECRET` containing at least 32 UTF-8 bytes before listening. Missing, blank, or short authentication configuration fails startup rather than permitting empty-key or application-unbound session tokens. Generate the signing value with a cryptographically secure secret manager and never expose it through `VITE_*` or source control. Production binds only the assigned port and exits non-zero with a bounded error-type event if configuration or the initial listen fails; it does not move to an unadvertised port that the hosting router cannot reach. The bounded alternative-port search is development-only.

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
| Corrupted, oversized, or incompatible upload | POST a malformed PNG/JPEG, an over-limit request, or an unsupported channel format to `/api/v1/classify` | HTTP `422`; no simulated prediction is returned. |
| Valid public research image | Submit one lawful, non-sensitive fixed-split public JPEG or PNG | HTTP `200` with the actual experimental class, model confidence score, calibrated state, Grad-CAM payload, and mandatory non-clinical warnings. This is image-level experimental evidence only. |
| Derived report | POST only a current server-issued Mode A receipt and its matching Grad-CAM payload to `/api/v1/report` | With owner-configured signing, a valid `%PDF` contains the verified receipt metadata and real Grad-CAM attribution; no raw MRI is embedded or stored by the dashboard. Without signing, the route returns `503` and the branch dashboard offers no report action. Mode B report requests and segmentation overlays return HTTP `422` until a verified full-volume release exists. |
| Dashboard integration | Set `VITE_INFERENCE_API_BASE_URL`, restart the managed dashboard, and upload the same file | The UI surfaces the authoritative response. Authenticated users can consent to save metadata, the derived PDF, and Grad-CAM to protected history; the original MRI upload is not saved. |

## Publication boundary

## Vercel academic-demo backend attempt

An authorized Vercel deployment of `backend/` was created from the private repository on 2026-08-22. The first build failed because default PyTorch dependencies produced a **4,658.61 MB** Python function bundle, exceeding Vercel’s reported **500 MB** maximum. A CPU-only PyTorch attempt reduced this to 794.41 MB but still exceeded the limit. The deployment path therefore changed to ONNX Runtime.

The final ONNX deployment passed HTTPS health and readiness, exact-preview-origin CORS preflight, malformed-upload rejection, actual inference on one lawful public fixed-split test image, and a two-page Mode A PDF report generated from that response and real Grad-CAM. The report surface now rejects Mode B requests and synthetic segmentation overlays with HTTP `422`. An early report-route failure was isolated to the external FPDF layout behavior and corrected using explicit paragraph widths. The output from the public glioma-labelled test image was **meningioma** with model confidence score `0.825931191444397`; this incorrect result is retained as evidence of an experimental, non-diagnostic system rather than being hidden or treated as clinical performance.

The selected experimental checkpoint remains outside Git and raw MRI datasets are not uploaded. The Vercel entry point can retrieve only the published checkpoint and calibration JSON through HTTPS and checks their fixed SHA-256 values before loading. It preserves the academic, non-diagnostic boundary in every response.

For any **future** managed-dashboard publication, first obtain explicit owner approval because a checkpoint publishes automatically in this project. Confirm the exact public dashboard HTTPS origin remains in the Vercel CORS allowlist alongside localhost development origins, then re-verify preflight and the dashboard integration. Publication does not make the experimental model clinically valid and must retain the persistent notice: **“This system is not a medical diagnosis and must not replace a qualified radiologist.”**

The authorized dashboard is published at `https://neuroaiapp-gtbxy6cw.manus.space`. The Vercel backend CORS allowlist now contains this exact HTTPS origin plus `http://localhost:3000` and `http://127.0.0.1:3000` only. A preflight request from the published origin returned HTTP `200` with `access-control-allow-origin: https://neuroaiapp-gtbxy6cw.manus.space`; an unrelated HTTPS origin returned HTTP `400` with no allow-origin header. The dashboard build configuration points to the corresponding verified backend deployment and must be rebuilt after this environment update.

The dashboard was rebuilt after the environment update. A browser-level real-inference test against `https://neuroaiapp-gtbxy6cw.manus.space` passed: one lawful public fixed-split image travelled through the published dashboard, the experimental result rendered, and the protected-save consent control appeared. A separate signed-in check saved only derived Mode A metadata/PDF/Grad-CAM, retrieved the report through a fresh ownership-gated URL, and deleted the temporary record. These checks do not establish model correctness or clinical validity.

## PR #1 report-signing decision before any future promotion

The current public deployment predates PR #1’s receipt requirement. Production presence of `ANALYSIS_RECEIPT_SECRET` is **unknown and owner-controlled**: the authorized read-only project metadata does not expose environment-variable presence, and no secret inspection or configuration change was performed.

The owner has exactly two release choices. **Option A — preserve PDF reports:** provision a strong server-only `ANALYSIS_RECEIPT_SECRET`, then verify a controlled non-production Mode A classification, receipt issuance, PDF generation, process-local replay behavior, and Grad-CAM binding before separately approving production. **Option B — intentionally disable reports:** promote without a secret only when the dashboard keeps its clear report-unavailable state and product documentation no longer advertises current PDF availability. Neither option authorizes automatic promotion.
