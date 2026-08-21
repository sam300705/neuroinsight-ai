# Environment Contract

The managed application receives its database, authentication, object-storage, and optional built-in language-model credentials from the deployment platform. No `.env` file or model secret is committed.

| Setting | Purpose | Required for |
|---|---|---|
| Platform database connection | Persist anonymized scan history and artifact references | History features |
| Platform object-storage credentials | Store derived reports, heatmaps, masks, and 3D artifacts | Artifact re-download |
| Built-in language-model credentials | Optional safe contextual-chat enhancement | Optional; offline FAQ remains available without it |
| `VITE_INFERENCE_API_BASE_URL` | Public base URL of a separately deployed FastAPI service | Live model inference only |
| `INFERENCE_SERVICE_TOKEN` | Server-side authentication token for the external inference service | Live model inference only |
| `MAX_UPLOAD_BYTES` | Server-side maximum accepted raw upload size | FastAPI deployment configuration |

The last three settings are deployment configuration values and will be added through the platform’s secret-management flow only when a FastAPI service is deployed. The dashboard remains usable without them, presenting explicit model-unavailable states and the offline FAQ fallback.

