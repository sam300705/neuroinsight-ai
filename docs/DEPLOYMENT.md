# Deployment Handover

The managed Node dashboard and the Python validation service are intentionally deployable as **separate components**. This keeps the dashboard compatible with managed hosting while isolating the scientific Python runtime. The project deliberately does **not** package exploratory model weights into either component.

| Component | Packaging state | Operational boundary |
|---|---|---|
| React + tRPC dashboard | Managed Node application | It can be published from the project interface after review of a saved checkpoint. |
| Scan metadata and derived artifact references | Managed database plus preconfigured object storage | History procedures require an authenticated account; raw scans are not persisted by default. |
| FastAPI validation/report service | `backend/Dockerfile` and `backend/compose.yaml` | Run separately on a Python-capable service. The current endpoint validates inputs and returns an honest **unavailable-model** state. |
| Exploratory classification/segmentation checkpoints | Intentionally external to the repository and container context | They must not be deployed before the provenance, calibration, and held-out-evaluation gates in `docs/OPEN_GATES.md` close. |

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

The container has no model weight files. A successful request to `/api/v1/analyze` therefore confirms only multipart upload validation and truthful unavailable-model handling; it does **not** confirm model inference.

## Smoke-test procedure

| Step | Command or action | Expected evidence |
|---|---|---|
| Health endpoint | `curl -fsS http://127.0.0.1:8000/health` | `status: ok` and the service identifier. |
| Readiness endpoint | `curl -fsS http://127.0.0.1:8000/ready` | `ready: false` with an explicit model-unavailable reason. |
| Corrupted upload | `curl -sS -o /dev/null -w "%{http_code}" -F mode=classification -F file=@/path/to/corrupt.png http://127.0.0.1:8000/api/v1/analyze` | HTTP `422`; do not substitute a model result. |
| Valid research file | Submit a non-sensitive compatible test image or NIfTI volume | HTTP `200` with `status: unavailable`, no prediction, no confidence score, and manual review recommended. |
| Dashboard integration | Set `VITE_INFERENCE_API_BASE_URL`, rebuild, and upload the same file | The UI surfaces the server validation result and navigates only after an honest response. |

## Publication boundary

## Vercel academic-demo backend attempt

An authorized Vercel preview of `backend/` was created from the private repository on 2026-08-22. The first build failed before serving any request because default PyTorch dependencies produced a **4,658.61 MB** Python function bundle, exceeding Vercel’s reported **500 MB** maximum. A CPU-only PyTorch attempt reduced this to 794.41 MB but still exceeded the limit. The deployment path was therefore changed to the verified ONNX Runtime implementation, which completed a Vercel build successfully. Its first health request revealed a missing `fpdf2` dependency required by the existing PDF report module; this dependency is now declared explicitly. No external endpoint is treated as verified until health, readiness, CORS, corrupt-upload, real non-sensitive inference, and report paths all pass.

The selected experimental checkpoint remains outside Git and raw MRI datasets are not uploaded. The Vercel entry point can retrieve only the published checkpoint and calibration JSON through HTTPS and checks their fixed SHA-256 values before loading. It preserves the academic, non-diagnostic boundary in every response.

To publish the current managed dashboard, create and review a checkpoint, then use the project interface’s **Publish** control. Publication does not authorize model activation. The public dashboard must retain its unavailable-model state until the separate evidence gates are closed.
