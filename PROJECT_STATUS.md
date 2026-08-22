# NeuroInsight AI — Project Status

**Last updated:** 2026-08-23  
**Current readiness:** **Level 1 — functional academic demonstration.** The project is not a medical device, a patient-level validated system, or a clinical deployment.

> **Required notice:** “This system is not a medical diagnosis and must not replace a qualified radiologist.”

## Verified current capabilities

| Capability | Status | Verified boundary |
|---|---|---|
| Mode A four-class 2D classification | **Publicly available** | Experimental, fixed-split **image-level** classification only. |
| Model version | **EXP-005** | ResNet50 head-only model using BDNeuro-MRI v7. |
| Calibration and abstention | **Available** | Validation-only temperature scaling (`T=0.689875`) and a `0.55` abstention threshold; the displayed score is not a medical probability. |
| Grad-CAM and PDF | **Available** | Both are generated from real Mode A inference; Grad-CAM is attribution, not segmentation. |
| Private derived-artifact history | **Verified** | With consent, saves anonymous metadata plus derived PDF/Grad-CAM only; ownership-gated re-download was verified. |
| Mode B segmentation | **Intentionally unavailable** | No full-volume model with defensible held-out validation is deployed. |

The public dashboard is <https://neuroaiapp-gtbxy6cw.manus.space>. Its CORS-restricted ONNX inference service is documented in `docs/DEPLOYMENT.md` and `docs/PUBLIC_HANDOVER.md`.

## Verified evidence

EXP-005 achieved held-out fixed-split **image-level** accuracy `0.8099`, macro-F1 `0.8080`, and weighted-F1 `0.8110`. These results are not patient-independent, external, clinical, diagnostic, or medical-probability evidence. The latest recorded regression evidence is **24** Vitest tests, **12** FastAPI tests, **6** ML/data tests, passing TypeScript/build checks, passing browser inference checks, and a user-approved signed-in derived-artifact retrieval check. See `docs/TEST_REPORT.md` for methods and boundaries.

## Current research work

An independent BRISC 2025 research-data audit is under way in an untracked local workspace. It is a separate experiment and does not alter the deployed EXP-005 service. The work will first audit integrity, paired masks, duplicates, and split leakage; any classification or segmentation experiment remains separately gated by the resulting evidence.

The completed bounded BRISC `EXP-006` ResNet18 classifier experiment did not meet the separate promotion bar: its official image-level test accuracy was `0.7510` and macro-F1 `0.7501`, lower than EXP-005. Its checkpoint remains outside Git and was not deployed.

## Remaining gates

The only product capability intentionally held back is Mode B. Activating it requires a full-volume, case-disjoint model and evaluation, uncertainty policy, artifact verification, and a separate public-release decision. The project must not infer physical tumour size, volume, or 3D geometry from the current 2D classifier.
