# NeuroInsight AI Implementation Plan

## Delivery strategy

The project will be built as a reproducible monorepo containing a React/TypeScript frontend, a versioned FastAPI service, isolated machine-learning modules, dataset preparation scripts, tests, documentation, and deployment assets. The application will use two explicit analysis modes: four-class 2D classification and glioma-focused volumetric segmentation. The backend will keep raw uploads temporary by default and will persist only anonymized history records and derived artifacts needed to reopen a demo result.

## Phase gates

| Phase | Work | Verification gate | Evidence to record |
|---|---|---|---|
| 1. Audit | Requirements, scientific, dataset, and risk documents; decision log | Documents exist, sources are linked, contradictions are resolved, no raw data downloaded prematurely | Audit files, decisions, status update, commit |
| 2. Scaffold | Repository, frontend/backend structure, configuration, environment files, baseline CI | Fresh install and health endpoint work; no secrets tracked | Setup log, CI result, commit |
| 3. Data pipeline | Authorized dataset preparation, integrity checks, duplicate detection, patient-level manifests, quality report | Manifest and split audit pass; no train/test patient overlap where identifiers exist | Data audit JSON/Markdown, sample visualizations, commit |
| 4. Classification | ResNet50 and EfficientNetB0 transfer-learning experiments, validation selection, held-out test evaluation | Deterministic inference, saved checkpoint/config/class map, honest metrics and failure cases | Experiment records, metrics JSON, plots, model card, commit |
| 5. Calibration and uncertainty | Temperature scaling, entropy, quality checks, abstention threshold | Threshold chosen on validation only; coverage, accepted accuracy, abstentions, calibration, and high-confidence errors recorded | Calibration report, tests, commit |
| 6. Segmentation | NIfTI loader, modality/spacing validation, binary U-Net, metrics, mask export | Synthetic formula tests, patient-level split, per-patient Dice/IoU/sensitivity/specificity, failure gallery | Segmentation metrics, model card update, commit |
| 7. Explainability and measurement | Grad-CAM, overlays, opacity control, area/volume calculations, 3D geometry for supported volumes | Blank/normal/abnormal explainability tests, synthetic area/volume checks, no unsupported unit claims | Artifact examples, tests, documentation, commit |
| 8. Backend | Secure uploads, model lifecycle, analysis orchestration, PDF, chat, history | Endpoint unit/integration tests, corrupted/oversized/wrong-MIME tests, PDF text/render checks, chatbot safety tests | Test report, API docs, security notes, commit |
| 9. Frontend | Responsive dashboard, all states, overlays, charts, history, chatbot, methodology and limitations | Component tests, accessibility checks, end-to-end user stories, console/network audit | Browser test report and screenshots, commit |
| 10. Packaging and deployment | Docker/Compose, migrations, CI, environment docs, deployment | Fresh clone install, image build, smoke test, public URL opened and verified if authorized | Deployment log, exact URLs, commit, status update |
| 11. Academic handover | Final report, corrected synopsis, presentation, demo script, viva guide, revision sheet, portfolio/resume/LinkedIn copy | All claims match actual implementation and metrics; no placeholders or fabricated results | Handover package and final status |

## Planned technical decisions

The initial classifier will use a lightweight inference path that can run on CPU, with transfer learning from ResNet50 and EfficientNetB0 where model weights are legally and reproducibly obtainable. The pipeline will store preprocessing configuration, class mappings, architecture, optimizer, seeds, and checkpoint provenance. If pretrained weight download is unavailable or unlicensed, the repository will document the exact blocker rather than silently substituting an unverified artifact.

The segmentation model will begin with binary whole-tumor U-Net on compatible BraTS-style volumes. The loader will validate sequence presence, shape compatibility, orientation, and spacing. A browser 3D view will use a downsampled derived mesh or voxel representation for interaction while retaining original-resolution quantitative measurements on the server.

The backend will use SQLite for local development and SQLAlchemy models designed for PostgreSQL-compatible deployment. A minimal LLM integration will be optional; the safe deterministic FAQ path remains the default. The frontend will be static-buildable and will communicate with the versioned API through a narrowly configured base URL.

## Deployment decision

The application has a hard requirement for Python scientific dependencies, optional Docker, model artifacts, and potentially more than a small serverless memory budget. A managed frontend/API deployment will be attempted first where it can support the workload. A separate Python service or a user-authorized existing cloud account may be required for a production-like backend. No paid service will be purchased, and no external deployment will be declared successful until its public URL is opened and smoke-tested.

## Reproduction commands to finalize

The exact commands will be generated after scaffolding and recorded in `README.md`, including environment creation, dataset preparation, training, evaluation, test execution, local Compose startup, and deployment. Commands will not claim a trained model or live URL until those artifacts exist and have been verified.
