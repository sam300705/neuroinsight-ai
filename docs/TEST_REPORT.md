# Verification Report

**Verification date:** 2026-08-21. The managed dashboard, TypeScript server, FastAPI service, and reproducibility utilities were checked after server-side upload-validation wiring, protected artifact-download retrieval, bilingual UI updates, and deployment-asset preparation. No test or document in this report treats the exploratory models as clinical or deployable artifacts.

| Layer | Command or method | Actual result |
|---|---|---|
| FastAPI service | `PYTHONPATH=. pytest -q` | **12 passed**. Coverage includes upload rejection, unavailable-model honesty, configured-origin CORS behavior, measurement safeguards, English/Hindi safety refusals, and PDF report contents/artifact pages. |
| Data utilities | `PYTHONPATH=. pytest -q ml/tests` | **4 passed**. Covers exact-duplicate safeguards, split metadata, NIfTI modality grouping, label linking, and AppleDouble exclusion. |
| Typed application | `pnpm check` | **Passed** with no TypeScript errors. |
| Node and frontend procedures | `pnpm test` | **17 passed**. Covers auth logout; scan-result, artifact, and delete-confirmation validation; local upload validation; corrupt-upload server-response mapping; unavailable-model response mapping; English/Hindi route-copy safeguards; and bilingual academic, Grad-CAM, and glioma-scope safety notices. |
| Production bundle | `pnpm build` | **Passed**. The bundle emits a size warning because the optional 3D renderer increases the main JavaScript chunk to approximately 1.36 MB; this is a performance follow-up, not a build failure. |
| Python package build | `uv build --wheel --out-dir /tmp/neuroinsight-wheelcheck` from `backend/` | **Passed**. The FastAPI service package builds as a standard wheel after explicit setuptools metadata was added. |
| Visual review | Desktop and mobile screenshots of overview, analysis, results, and history | Confirmed readable global disclaimer, responsive navigation, scoped upload guidance, private history empty state, and research-safe no-analysis result state. Detailed findings are in `docs/VERIFICATION_LOG.md`. |

## Actual model-development evidence

The classification smoke runs used a dataset with unresolved source-provenance limitations and a non-patient-level hash-grouped development split; neither classifier is exposed to the application. The segmentation smoke run used a public Task01 NIfTI source with a case-level development split, but it remains a selected-slice, small 2D experiment. Its 0.6759 mean validation slice Dice is not a full-volume, hidden-test, or clinical result. The saved Grad-CAM image is a real attribution derived from the exploratory ResNet50 checkpoint, and it remains a coarse classifier-attribution artifact rather than a tumor boundary.

> **Release gate:** the app intentionally returns an unavailable analysis state until a provenance-approved, calibrated, held-out validated model artifact is installed and separately evaluated for its intended research scope.
