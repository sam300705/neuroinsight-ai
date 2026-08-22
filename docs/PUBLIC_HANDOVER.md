# NeuroInsight AI — Public Academic Demonstration Handover

**Public dashboard:** <https://neuroaiapp-gtbxy6cw.manus.space>  
**Inference service:** <https://neuroinsight-ai-inference-ovf50ho2k-sam300705s-projects.vercel.app>  
**Status:** Published academic demonstration; **not** a medical device, diagnostic service, or clinical decision-support deployment.

> **Required notice:** “This system is not a medical diagnosis and must not replace a qualified radiologist.”

## What is live

Mode A is a real experimental 2D, four-class brain-MRI image classifier. It returns a predicted research class, a validation-calibrated **model confidence score**, a low-confidence/manual-review state, and a real final-layer Grad-CAM attribution. It can also produce a derived academic PDF report. The published dashboard was verified by submitting one lawful public fixed-split image through the browser; the test asserts safe rendering and deliberately does **not** assert that the model’s class is correct.

| Component | Verified status | Scope boundary |
|---|---|---|
| Public dashboard | Live | Research and education only |
| HTTPS Mode A API | Live | Experimental image-level classification only |
| Real inference and Grad-CAM | Verified | Grad-CAM is coarse attribution, not a tumor boundary |
| PDF report | Verified | Derived research report, not a clinical report |
| CORS | Verified | Allows only the published origin and localhost development origins |
| Mode B segmentation | Intentionally unavailable | No validated full-volume model is deployed |
| Private history re-download | Verified with a signed-in test session | Ownership-gated signed report retrieval; original uploads are never stored |

## Evidence and evaluation limits

EXP-005 used the audited BDNeuro-MRI v7 fixed image-level split. Its fixed-split held-out result was **0.8099 accuracy**, **0.8080 macro-F1**, and **0.8110 weighted-F1** after conservative cross-split similarity exclusions. Temperature scaling used only validation data and selected a `0.55` abstention threshold. These are experimental image-level findings; they are **not** patient-independent, clinical, external-validation, diagnostic, or medical-probability evidence.

The authoritative data and model evidence are maintained in:

| Record | Purpose |
|---|---|
| `DATASET_AUDIT.md` | Source, licence, split, duplicate-review, and provenance evidence |
| `EXPERIMENTS.md` | Training and held-out evaluation ledger |
| `docs/CALIBRATION_STATUS.md` | Validation-only calibration and abstention policy |
| `ml/classification/MODEL_CARD.md` | Model scope and limitations |
| `docs/TEST_REPORT.md` | Automated, browser, API, ML, and build verification |
| `docs/VERIFICATION_LOG.md` | External service and visual/browser verification narrative |

## Privacy and artifact handling

The browser sends an uploaded image to the external research API only for the requested analysis. The application is designed **not** to store the original MRI upload. If a signed-in user explicitly saves a result, the application retains only anonymous result metadata and derived report or Grad-CAM artifacts. Artifact download lookup requires ownership of the associated history record and issues a fresh signed URL rather than exposing a durable storage path.

No raw data, public test image, user credential, or secret is committed to Git.

## Tested release state

The final regression run passed all of the following:

| Layer | Result |
|---|---|
| Web tests | 24 passing tests |
| FastAPI tests | 12 passing tests |
| ML/data tests | 6 passing tests |
| TypeScript check | Passed |
| Production bundle | Passed; non-blocking JavaScript chunk-size warning recorded |
| Browser checks | Corrupt upload, real Mode A inference, Hindi real inference, focused accessibility, cross-route WCAG 2 A/AA, and published-dashboard real inference all passed |

The backend accepted a CORS preflight from the public dashboard origin and rejected an unrelated origin without an allow-origin header.

## Operational safeguards

Do not use the site to make medical decisions. Do not upload personal, patient-identifying, or private medical images. Keep the visible research disclaimer intact. Do not enable Mode B from the old 2D smoke checkpoint; a full-volume dataset, model, validation plan, held-out evaluation, calibration/uncertainty policy, and real artifact verification are required first.

When redeploying the Vercel backend, update both the dashboard inference base URL and the backend `CORS_ALLOWED_ORIGINS` list to the exact backend/public-dashboard HTTPS origins, then repeat health, readiness, allowed-origin preflight, rejected-origin preflight, and public-browser inference checks.

## Remaining research gates

The following tasks are intentionally not presented as completed:

1. Build and validate a genuinely full-volume, glioma-focused Mode B segmentation route before exposing masks, physical measurement, volume, or 3D geometry as real output.

The Mode B gate exists to avoid fabricating unvalidated medical-imaging behavior. The signed-in Mode A check used a lawful public demonstration image, saved only derived metadata/PDF/Grad-CAM artifacts, verified ownership-gated report retrieval through a fresh signed URL, and then removed the temporary record.
