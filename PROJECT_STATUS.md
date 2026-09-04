# NeuroInsight AI — Project Status

**Last updated:** 2026-09-04
**Current readiness:** **Level 1 — functional academic demonstration.** The project is not a medical device, a patient-level validated system, or a clinical deployment.

> **Required notice:** “This system is not a medical diagnosis and must not replace a qualified radiologist.”

## Verified current capabilities

| Capability | Status | Verified boundary |
|---|---|---|
| Mode A four-class 2D classification | **Publicly available** | Experimental, fixed-split **image-level** classification only. |
| Model version | **EXP-005** | ResNet50 head-only model using BDNeuro-MRI v7. |
| Calibration and abstention | **Available** | Validation-only temperature scaling (`T=0.689875`) and a `0.55` abstention threshold; the displayed score is not a medical probability. |
| Grad-CAM and PDF | **Verified on earlier public recovery; receipt-dependent in current PR** | Both derive from real Mode A inference; Grad-CAM is attribution, not segmentation. A PR #1 release without the owner-controlled signing secret disables PDF generation fail-closed. |
| Private derived-artifact history | **Verified** | With consent, saves account-linked pseudonymous metadata plus derived Mode A PDF/Grad-CAM only; each retrieval receives a fresh ownership-gated URL. |
| Mode B segmentation | **Intentionally unavailable** | No full-volume model with defensible held-out validation is deployed. |

The public dashboard is <https://neuroaiapp-gtbxy6cw.manus.space>. Its CORS-restricted ONNX inference service is documented in `docs/DEPLOYMENT.md` and `docs/PUBLIC_HANDOVER.md`.

## Verified evidence

EXP-005 achieved held-out fixed-split **image-level** accuracy `0.8099`, macro-F1 `0.8080`, and weighted-F1 `0.8110`. These results are not patient-independent, external, clinical, diagnostic, or medical-probability evidence. Current branch evidence is **64** Vitest tests, **113** FastAPI/support tests, and **8** ML/data tests; passing TypeScript, build, bundle, and selected-module coverage gates; clean production Node and Python audits; receipt-protected report integrity; optional atomic shared abuse/replay state with fail-closed required mode; privacy-bounded request events and no-store API responses; obvious non-MRI rejection; bounded 512-pixel Grad-CAM output; memory-only browser analysis state; non-persistent account profiles and seven-day sessions; strict runtime response validation and request deadlines; retry-safe deterministic artifact keys; physical-delete-before-metadata behavior; and strict Mode B failure boundaries. These branch totals do not mean the public dashboard has been republished, and passing the heuristic input screen does not prove MRI modality or in-distribution status. Shared Upstash and operational alerting are code/documentation-ready but not provisioned or live-verified. See `docs/TEST_REPORT.md` for methods and boundaries.

## Current research work

An independent BRISC 2025 research-data audit is under way in an untracked local workspace. It is a separate experiment and does not alter the deployed EXP-005 service. The work will first audit integrity, paired masks, duplicates, and split leakage; any classification or segmentation experiment remains separately gated by the resulting evidence.

The completed bounded BRISC `EXP-006` ResNet18 classifier experiment did not meet the separate promotion bar: its official image-level test accuracy was `0.7510` and macro-F1 `0.7501`, lower than EXP-005. Its checkpoint remains outside Git and was not deployed.

## Remaining gates

The only product capability intentionally held back is Mode B. A new `scripts/build_case_disjoint_full_volume_manifest.py` utility can prepare complete image-plus-label NIfTI cases for case-disjoint development, but it does not train or activate a model. Activating Mode B still requires a full-volume, case-disjoint model and held-out evaluation, uncertainty policy, artifact verification, and a separate public-release decision. The project must not infer physical tumour size, volume, or 3D geometry from the current 2D classifier.
