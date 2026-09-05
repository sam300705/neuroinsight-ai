# NeuroInsight AI — Public Academic Demonstration Handover

**Public dashboard:** <https://neuroaiapp-gtbxy6cw.manus.space>  
**Inference service:** <https://neuroinsight-ai-inference-ovf50ho2k-sam300705s-projects.vercel.app>  
**Status:** Published academic demonstration; **not** a medical device, diagnostic service, or clinical decision-support deployment.

> **Required notice:** “This system is not a medical diagnosis and must not replace a qualified radiologist.”

## Release distinction

The managed public dashboard reflects the earlier owner-approved recovery checkpoint `409f8a70`; it has **not** received the current PR hardening pass. The Vercel inference project remains linked to GitHub: its production target is `main` at `26498b5`, while pull request previews are branch-specific and non-production. The branch-level verification totals recorded below apply to PR #1’s working tree and must not be described as an additional public dashboard publication.

## What is live

Mode A is a real experimental 2D, four-class brain-MRI image classifier. It returns a predicted research class, a validation-calibrated **model confidence score**, a low-confidence/manual-review state, and a real final-layer Grad-CAM attribution. It can also produce a derived academic PDF report. The published dashboard was verified by submitting one lawful public fixed-split image through the browser; the test asserts safe rendering and deliberately does **not** assert that the model’s class is correct.

| Component | Verified status | Scope boundary |
|---|---|---|
| Public dashboard | Live | Research and education only |
| HTTPS Mode A API | Live | Experimental image-level classification only |
| Real inference and Grad-CAM | Verified | Grad-CAM is coarse attribution, not a tumor boundary |
| PDF report | Verified on the earlier public recovery release | Derived research report, not a clinical report. The current PR requires a server-issued receipt and production signing configuration before any future release can offer reports. |
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

The browser sends an uploaded image to the external research API only for the requested analysis. The application is designed **not** to store the original MRI upload. If a signed-in user explicitly saves a result, the application retains only account-linked pseudonymous result metadata and derived Mode A report or Grad-CAM artifacts. Artifact download lookup requires ownership of the associated history record and issues a fresh signed URL rather than exposing a durable storage path. Deleting a history record revokes application access to its artifact references; it is not a provider-side physical-erasure guarantee.

No raw data, public test image, user credential, or secret is committed to Git.

## Current PR verification state

The public dashboard and production inference target remain on the earlier owner-approved release. The following totals apply only to PR #1 and its non-production Git previews until the owner separately approves merge and release.

The final regression run passed all of the following:

| Layer | Result |
|---|---|
| Web tests | **48 passing tests** |
| FastAPI tests | **100 passing tests** |
| ML/data tests | 8 passing tests |
| TypeScript check | Passed |
| Coverage | Passed with selected TypeScript/Python critical-module thresholds |
| Production bundle | Passed; initial bundle is 697,072 bytes under the 768,000-byte guard |
| Dependency audits and SBOM | Production Node audit and locked Python audit passed; CI generates a CycloneDX SBOM and runs a credential-free backend container smoke test |
| Browser checks | Corrupt-upload, focused accessibility, and cross-route WCAG 2 A/AA checks passed against a local production build. Historical live Mode A and signed-in artifact checks remain evidence for the earlier public release, not the current branch. |

The backend accepted a CORS preflight from the public dashboard origin and rejected an unrelated origin without an allow-origin header.

## PR #1 report-receipt release consequence

PR #1 treats report integrity as a user-visible release decision. If this PR reaches a production target without `ANALYSIS_RECEIPT_SECRET`, Mode A classification remains expected to work when its model configuration is intact, but no report receipt is issued and `/api/v1/report` returns `503`. The Results page now makes that absence explicit: it offers neither a PDF nor a derived-artifact save action and does not retry or manufacture a download.

There are exactly two valid owner choices before any production promotion:

1. **Preserve PDF reports.** Provision a strong server-only `ANALYSIS_RECEIPT_SECRET` outside Git, browser code, and logs; verify a controlled non-production classify → receipt → report flow, replay behavior within its documented process-local scope, and Grad-CAM digest binding; then decide separately whether to release.
2. **Intentionally disable reports.** Release without that secret only after retaining the explicit unavailable report state and updating all relevant product copy so users are not told that PDF reports are available.

## Operational safeguards

Do not use the site to make medical decisions. Do not upload personal, patient-identifying, or private medical images. Keep the visible research disclaimer intact. Do not enable Mode B from the old 2D smoke checkpoint; a full-volume dataset, model, validation plan, held-out evaluation, calibration/uncertainty policy, and real artifact verification are required first.

When redeploying the Vercel backend, update both the dashboard inference base URL and the backend `CORS_ALLOWED_ORIGINS` list to the exact backend/public-dashboard HTTPS origins, then repeat health, readiness, allowed-origin preflight, rejected-origin preflight, and public-browser inference checks.

## Remaining research gates

The following tasks are intentionally not presented as completed:

1. Build and validate a genuinely full-volume, glioma-focused Mode B segmentation route before exposing masks, physical measurement, volume, or 3D geometry as real output.

The Mode B gate exists to avoid fabricating unvalidated medical-imaging behavior. The signed-in Mode A check used a lawful public demonstration image, saved only derived metadata/PDF/Grad-CAM artifacts, verified ownership-gated report retrieval through a fresh signed URL, and then removed the temporary record.
