# Environment Contract

The managed application receives its database, authentication, object-storage, and optional built-in language-model credentials from the deployment platform. No `.env` file or model secret is committed.

| Setting | Purpose | Required for |
|---|---|---|
| Platform database connection | Persist anonymized scan history and artifact references | History features |
| Platform object-storage credentials | Store derived Mode A reports and Grad-CAM heatmaps only | Authenticated artifact re-download |
| Built-in language-model credentials | Optional safe contextual-chat enhancement | Optional; offline FAQ remains available without it |
| `VITE_INFERENCE_API_BASE_URL` | Public base URL of a separately deployed FastAPI service | Live model inference only |
| `CORS_ALLOWED_ORIGINS` | Exact comma-separated dashboard and local-development origins permitted by FastAPI | FastAPI deployment configuration |
| `USE_ONNX_CLASSIFIER` and `ENABLE_EXPERIMENTAL_MODEL` | Explicitly enable the checksum-verified ONNX runtime when all artifact settings below are present | Verified external Mode A deployment only |
| `CLASSIFICATION_ONNX_URL`, `CLASSIFICATION_ONNX_SHA256` | HTTPS location and fixed SHA-256 for the audited EXP-005 ONNX checkpoint | Verified external Mode A deployment only |
| `CLASSIFICATION_ONNX_METADATA_URL`, `CLASSIFICATION_ONNX_METADATA_SHA256` | HTTPS location and fixed SHA-256 for checkpoint metadata | Verified external Mode A deployment only |
| `CLASSIFICATION_CALIBRATION_URL`, `CLASSIFICATION_CALIBRATION_SHA256` | HTTPS location and fixed SHA-256 for validation-only calibration metadata | Verified external Mode A deployment only |
| `MODEL_CACHE_DIR` | Optional writable cache location for checksum-verified inference artifacts | Optional FastAPI deployment configuration |

The service has **no configured `INFERENCE_SERVICE_TOKEN`**. It relies on exact CORS allowlisting and accepts only intended public academic-demo traffic; do not document a token that the runtime does not verify. `MAX_UPLOAD_BYTES` is a source-controlled 50 MB FastAPI limit, not an environment variable. The service also rejects a multipart request over 51 MB, reads no more than 50 MB of file content, and rejects images above 12 megapixels or with incompatible channel modes.

The dashboard remains usable without the inference settings, presenting explicit model-unavailable states and the offline FAQ fallback. Supplying runtime variables does not promote a new model, enable segmentation, store raw MRI uploads, or remove the permanent non-diagnostic boundary.
