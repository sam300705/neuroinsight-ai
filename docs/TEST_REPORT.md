# Verification Report

**Verification date:** 2026-08-22. The managed dashboard, TypeScript server, FastAPI service, reproducibility utilities, and external ONNX service were checked after the real Mode A integration, report-route correction, browser-level upload checks, and protected derived-artifact wiring. No test or document in this report treats any model output as clinical, diagnostic, patient-level, or externally validated.

| Layer | Command or method | Actual result |
|---|---|---|
| FastAPI service | `PYTHONPATH=. pytest -q` | **12 passed**. Coverage includes upload rejection, configured-origin CORS behavior, measurement safeguards, English/Hindi safety refusals, real-response schema compatibility, and PDF report contents/artifact pages. |
| Data utilities | `PYTHONPATH=. pytest -q ml/tests` | **4 passed**. Covers exact-duplicate safeguards, split metadata, NIfTI modality grouping, label linking, and AppleDouble exclusion. |
| Typed application | `pnpm check` | **Passed** with no TypeScript errors. |
| Node and frontend procedures | `pnpm test` | **20 passed**. Covers auth logout; scan-result, artifact, and delete-confirmation validation; local upload validation; corrupt-upload and real-result response mapping; report helper serialization; configured-endpoint health; English/Hindi route-copy safeguards; and bilingual academic, Grad-CAM, and glioma-scope safety notices. |
| Browser-level flow | `pnpm test:e2e:corrupt-upload`, `pnpm test:e2e:real-inference`, and `pnpm test:e2e:accessibility` | **Passed**. The corruption test proves local signature rejection disables submission. The real-inference test submits one lawful public fixed-split image and verifies the experimental result, exact safety warning, non-medical confidence wording, and protected-save consent control without asserting class correctness. The accessibility test verifies keyboard skip navigation, labelled MRI upload access, and text plus disabled-state error communication. |
| Hindi real-inference flow | `pnpm test:e2e:hindi-real-inference` | **Passed**. The test changes the UI to Hindi, submits one lawful public fixed-split image, and verifies the localized experimental-result and protected-save controls. The exact mandatory English non-diagnostic notice remains visible. |
| Published live integration | `E2E_BASE_URL=https://neuroaiapp-gtbxy6cw.manus.space pnpm test:e2e:real-inference` | **Passed**. The published dashboard reached the CORS-restricted Vercel ONNX service and rendered the real experimental result plus protected-save consent control. This is a connectivity check only and does not assert class correctness, clinical validity, or authenticated artifact retrieval. |
| Cross-route accessibility | `pnpm test:e2e:accessibility-routes` | **Passed**. Axe-core WCAG 2 A/AA rules, including colour contrast, pass on overview, analysis, results, history, methodology, performance, limitations, and about. The test also verifies initial keyboard focus reaches the skip-to-main-content link on every route. Browser zoom is not restricted. |
| Production bundle | `pnpm build` | **Passed**. The bundle emits a size warning because the optional 3D renderer increases the main JavaScript chunk to approximately 1.40 MB; this is a performance follow-up, not a build failure. |
| Python package build | `uv build --wheel --out-dir /tmp/neuroinsight-wheelcheck` from `backend/` | **Passed**. The FastAPI service package builds as a standard wheel after explicit setuptools metadata was added. |
| Visual review | Desktop and mobile screenshots of overview, analysis, results, and history | Confirmed readable global disclaimer, responsive navigation, scoped upload guidance, private history empty state, and research-safe no-analysis result state. Detailed findings are in `docs/VERIFICATION_LOG.md`. |

## Actual model and deployment evidence

Mode A uses EXP-005: a ResNet50 head-only classifier trained on the authorised BDNeuro-MRI v7 fixed image-level split after a conservative duplicate-similarity sanitization policy. Its held-out fixed-split image-level test accuracy is `0.8099`, macro-F1 is `0.8080`, and validation-only temperature scaling selected temperature `0.689875` and abstention threshold `0.55`. These figures are not patient-independent, clinical, external, or diagnostic performance evidence.

The Vercel ONNX service passed health, readiness, CORS preflight, corrupt-upload rejection, real inference on one public fixed-split image, and a two-page report generated from its returned real Grad-CAM. That image’s actual predicted class was meningioma despite its glioma label. The system preserves this failure as experimental evidence; browser tests deliberately do not encode it as an expected correct classification. The Grad-CAM is a coarse final-layer classifier attribution, not a tumor boundary.

Mode B remains unavailable. The earlier small, selected-slice 2D segmentation smoke run is not a full-volume, hidden-test, or clinical segmentation model and cannot activate masks, measurements, volume, or 3D geometry as real service outputs.

> **Release gate:** Mode A is available only as an image-level, non-clinical academic demonstration with manual review required. Mode B remains unavailable. Authenticated end-to-end history re-download verification and final public-dashboard CORS configuration remain open before the dashboard is published.
