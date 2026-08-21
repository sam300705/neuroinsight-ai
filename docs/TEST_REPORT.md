# Verification Report

**Verification date:** 2026-08-21. The managed dashboard, TypeScript server, FastAPI service, and reproducibility utilities were checked after the final Grad-CAM and interactive-geometry additions. No test or document in this report treats the exploratory models as clinical or deployable artifacts.

| Layer | Command or method | Actual result |
|---|---|---|
| FastAPI service | `PYTHONPATH=. pytest -q tests` | **11 passed**. Coverage includes upload rejection, unavailable-model honesty, measurement safeguards, English/Hindi safety refusals, and PDF report contents/artifact pages. |
| Data utilities | `pytest -q ml/tests` | **4 passed**. Covers exact-duplicate safeguards, split metadata, NIfTI modality grouping, label linking, and AppleDouble exclusion. |
| Typed application | `pnpm check` | **Passed** with no TypeScript errors. |
| Node procedures | `pnpm test` | **5 passed**. Covers auth logout plus scan-result/artifact/delete-confirmation validation. |
| Production bundle | `pnpm build` | **Passed**. The bundle emits a size warning because the optional 3D renderer increases the main JavaScript chunk to approximately 1.36 MB; this is a performance follow-up, not a build failure. |
| Visual review | Desktop screenshots of overview and history; mobile screenshot during prior dashboard verification | Confirmed readable global disclaimer, responsive navigation, and private history empty state. |

## Actual model-development evidence

The classification smoke runs used a dataset with unresolved source-provenance limitations and a non-patient-level hash-grouped development split; neither classifier is exposed to the application. The segmentation smoke run used a public Task01 NIfTI source with a case-level development split, but it remains a selected-slice, small 2D experiment. Its 0.6759 mean validation slice Dice is not a full-volume, hidden-test, or clinical result. The saved Grad-CAM image is a real attribution derived from the exploratory ResNet50 checkpoint, and it remains a coarse classifier-attribution artifact rather than a tumor boundary.

> **Release gate:** the app intentionally returns an unavailable analysis state until a provenance-approved, calibrated, held-out validated model artifact is installed and separately evaluated for its intended research scope.

