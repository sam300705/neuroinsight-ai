# NeuroInsight AI

NeuroInsight AI is a **non-clinical academic demonstration** of explainable 2D brain-MRI image classification. The live dashboard is <https://neuroaiapp-gtbxy6cw.manus.space>.

> **This system is not a medical diagnosis and must not replace a qualified radiologist.**

## What is available

Mode A performs real experimental four-class 2D classification—glioma, meningioma, pituitary tumour, or no tumour—using the deployed EXP-005 ResNet50 head-only model. The system provides a validation-calibrated model-confidence score, low-confidence/manual-review state, genuine Grad-CAM attribution, and a derived academic PDF. With explicit consent, a signed-in user may save only anonymous result metadata and derived PDF/Grad-CAM artifacts; original uploads are not stored by default.

On the audited BDNeuro-MRI v7 fixed image-level test split, EXP-005 recorded accuracy `0.8099`, macro-F1 `0.8080`, and weighted-F1 `0.8110`. These are experimental image-level results only, not patient-level, external, clinical, diagnostic, or medical-probability evidence.

## What is unavailable

Mode B segmentation is intentionally unavailable. The application does not return tumour masks, physical measurements, volume, or 3D geometry because no defensible full-volume segmentation model and held-out evaluation are deployed. Grad-CAM must never be interpreted as a segmentation mask.

## Architecture

The dashboard uses React, TypeScript, Vite, Tailwind, Express/tRPC, Drizzle, and protected user-scoped metadata storage. A separate FastAPI service uses ONNX Runtime for lightweight experimental Mode A inference, Grad-CAM, and reporting. CORS is restricted to the published dashboard origin and local development origins. Raw MRI uploads are neither committed nor retained by the history system.

## Local verification

```bash
pnpm check
pnpm test
pnpm build
```

The Python/API and machine-learning checks are documented in `docs/TEST_REPORT.md`. Public deployment, data provenance, calibration, privacy, and release boundaries are documented in `docs/PUBLIC_HANDOVER.md`, `DATASET_AUDIT.md`, `EXPERIMENTS.md`, `docs/CALIBRATION_STATUS.md`, and `docs/CAPABILITY_MANIFEST.md`.

## Research status

The application is **Level 1: a functional academic demo**. Future research may use separately authorised public data, but each new dataset/model must undergo provenance, integrity, duplicate/leakage, evaluation, and deployment review before it can affect the live service.
