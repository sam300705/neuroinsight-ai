# NeuroInsight AI Architecture

NeuroInsight AI separates the user-facing research dashboard from the model-serving pipeline while preserving a single auditable repository. The React application provides the responsive interface, localisation, accessibility controls, report/history views, and visualization components. The generated application server provides authentication-aware procedures, persistent history, derived-artifact storage, safety checks, and the offline chatbot fallback. The `backend/` workspace contains the independently runnable FastAPI model service required for reproducible local and external inference deployment.

| Layer | Responsibility | Boundary |
|---|---|---|
| React dashboard | Upload interface, accessible state handling, scan results, Grad-CAM and mask overlays, history, reports, chat, 3D controls | Never generates clinical claims or fabricates analysis results. |
| Application server | Authentication-aware history, artifact references, safe FAQ/chat orchestration, report persistence, application-level validation | Stores derived artifacts and minimal anonymized metadata; raw scans are temporary by default. |
| FastAPI model service | Content-aware file validation, deterministic preprocessing, classification, segmentation, uncertainty, Grad-CAM, measurement, PDF production | Handles only supported image/volume formats and returns explicit unavailable/unsupported states. |
| Machine-learning modules | Dataset manifests, duplicate checks, training/evaluation, calibration, model cards | No raw dataset or weight is committed. |
| Object storage | PDFs, Grad-CAM overlays, masks, compatible 3D artifacts | Database retains opaque storage references, never file bytes. |

## Analysis boundaries

Mode A accepts validated PNG and JPEG images for the four-class classifier. Its output uses the label **model confidence score** and not medical-probability language. Grad-CAM is attached only as classifier attribution and is visibly labelled as coarse, non-boundary evidence.

Mode B accepts a compatible NIfTI volume. Its segmentation model is constrained to the scope supported by its eventual training data; the initial product scope is glioma-focused. Area and volume are calculated separately: physical measurements require valid spatial metadata, otherwise the service returns pixel or voxel counts and relative occupancy. Interactive 3D geometry is available only after a segmentation mask exists.

## Data model

`scanRecords` will retain only the scan UUID, owner, timestamp, input type, analysis mode, class/segmentation summaries, confidence and uncertainty state, measurement metadata, model version, processing time, and storage keys/URLs for derived artifacts. It will never hold raw scan bytes, patient identifiers, clinical interpretations, or confidential prompt text.

## Deployment shape

The managed application can host the React dashboard, history store, offline FAQ, and derived-object storage. The FastAPI service is kept independently runnable through local Compose and can be deployed to a Python-capable environment when authorization and resource constraints permit. A managed one-container deployment is deliberately not claimed to be suitable for training or for large model serving under the documented 512 MiB runtime limit.

