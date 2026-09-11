# NeuroInsight AI

NeuroInsight AI is a **non-clinical academic demonstration** of explainable 2D brain-MRI image classification. The currently published dashboard is <https://neuroaiapp-gtbxy6cw.manus.space>.

> **This system is not a medical diagnosis and must not replace a qualified radiologist.**

## What is available

Mode A performs experimental four-class 2D classification—glioma, meningioma, pituitary tumour, or no tumour—using EXP-005, a ResNet50 head-only model. It returns a research class, validation-calibrated model-confidence score, low-confidence/manual-review state, and Grad-CAM attribution. Grad-CAM is a classifier attribution map, **not** a tumour segmentation boundary.

On the audited BDNeuro-MRI v7 fixed image-level test split, EXP-005 recorded accuracy `0.8099`, macro-F1 `0.8080`, and weighted-F1 `0.8110`. These are experimental **image-level** results only; they are not patient-independent, external, diagnostic, clinical, or medical-probability evidence.

The current branch also supports consent-controlled private derived-artifact history. It does not persist the source MRI through the history layer. Derived reports/Grad-CAM artifacts are stored under owner-scoped keys and re-download requires an ownership-gated fresh signed URL.

PDF generation additionally requires a server-issued signed analysis receipt. If `ANALYSIS_RECEIPT_SECRET` is not configured, report generation fails closed rather than manufacturing or trusting a client-provided result.

### Artifact lifecycle and recovery

The current branch uses durable artifact intents for registration, replacement, deletion, and crash recovery:

- intent persisted before upload
- immutable owner-scoped storage keys
- short database transactions with scan → intent → artifact lock ordering
- transactional active-pointer replacement
- transaction-locked single and bulk deletion snapshots
- physical provider deletion outside database transactions
- automatic bounded reconciliation when DB/storage are configured
- five-minute stale-upload settle grace
- retry/backoff plus an admin-only reconciliation path
- legacy `pending:` metadata-placeholder compatibility
- active scan/artifact referential guards restored by migration `0006`

See [`docs/ARTIFACT_LIFECYCLE_RECOVERY.md`](docs/ARTIFACT_LIFECYCLE_RECOVERY.md) and [`docs/MIGRATIONS.md`](docs/MIGRATIONS.md).

### Optional research explanation

The **Research Explanation Assistant** explains research scope, confidence/calibration, abstention, Grad-CAM limitations, methodology, report behavior, and Mode B unavailability in English or Hindi. It is not a medical advisor and cannot change a model output. The shipped configuration has a deterministic offline FAQ. An owner may configure one server-side OpenAI or Gemini provider only after the privacy/manual-gate review; browser code never receives a provider key or imaging payload.

## Deployment status

| Surface | Status | Boundary |
|---|---|---|
| Public dashboard | Live at the URL above | Earlier owner-approved recovery release; not automatically updated from PR #1 |
| Vercel inference production target | `main`-linked | Separate from feature-branch previews |
| PR #1 inference preview | Commit-specific `READY` preview when checks pass | Non-production; not a production promotion |

The final code-owned release candidate is tracked in [`docs/FINAL_RELEASE_CANDIDATE.md`](docs/FINAL_RELEASE_CANDIDATE.md). Passing CI or receiving a `READY` preview is not an authorization to merge, publish the managed dashboard, or promote production.

## Safe demo workflow

Use only a locally held, authorised PNG/JPEG outside any locked evaluation split. Do not upload personal, restricted, DICOM, NIfTI, or test-split data. Passing the conservative plausibility screen does not prove that an image is a valid MRI or that the output is medically meaningful.

Current browser analysis state—including filename, derived Grad-CAM, and report receipt—is memory-only rather than stored in browser local/session storage.

## What is unavailable

Mode B segmentation is intentionally unavailable. The application does not return validated tumour masks, physical measurements, volume, or 3D geometry because no defensible promoted full-volume segmentation model and locked held-out evaluation exist. Do not enable those features from an old 2D smoke experiment.

## Architecture

The dashboard uses React, TypeScript, Vite, Tailwind, Express/tRPC, Drizzle, and protected owner-scoped metadata storage. The inference service uses FastAPI and ONNX Runtime for lightweight experimental Mode A inference, Grad-CAM, and signed-receipt report generation.

The inference service uses strict input bounds, request deadlines, privacy-bounded error/log behavior, fail-closed readiness, and optional managed shared controls. Process-local fallback is explicitly not a cross-instance guarantee.

## Verification

The fully completed application-code baseline `e60272a44cb771624d4c1eff04336cb35843840f` passed GitHub Actions run `34526092850` (#196):

- **260/260** TypeScript/Vitest tests
- **143/143** FastAPI/support tests
- **8/8** ML/data tests
- selected TS coverage **94.69% statements/lines, 80.52% branches, 100% functions**
- all configured Python critical-module coverage thresholds
- production build and bundle gate
- browser corrupt-upload and cross-route WCAG 2 A/AA checks
- Node and Python production dependency audits with no known vulnerabilities
- Python lock verification and CycloneDX SBOM
- credential-free backend Docker build and health smoke

CI was then supply-chain hardened at `c675b4d` with exact Node-24-capable GitHub Action commit pins and fixed uv `0.12.13`.

Local core commands:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm test:coverage
pnpm build
pnpm check:bundle
pnpm audit --prod --audit-level=high
uv lock --directory backend --check
uv sync --directory backend --locked --extra test
uv run --directory backend --locked --extra test pytest -q backend/tests
uv run --directory backend --locked --extra test pytest -q ml/tests
```

See [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md) for the current evidence boundary.

## Database migration requirement

Artifact recovery requires the complete sequence:

`0004_equal_captain_flint.sql` → `0005_conscious_jocasta.sql` → `0006_restore_referential_guards.sql`.

**Do not stop at `0005`.** Run the documented orphan/null preflight before applying `0006` to a managed database. See [`docs/MIGRATIONS.md`](docs/MIGRATIONS.md).

## Security and privacy

Read `SECURITY.md` before reporting a vulnerability. Never put credentials, raw MRI files, signed URLs, personal data, or private medical images in public issues, PR comments, or logs. Contribution expectations are in `CONTRIBUTING.md`; repository governance is documented in `docs/REPOSITORY_GOVERNANCE.md`.

## Owner-controlled release gates

The repository cannot truthfully complete these through code alone: protecting `main`, applying/validating managed DB migrations, configuring real `VITE_APP_ID`/`JWT_SECRET`, configuring report signing if reports remain enabled, verifying provider-side physical artifact deletion, provisioning distributed shared state if cross-instance guarantees are claimed, configuring operational alerts/retention, and explicitly approving PR merge/dashboard publication/Vercel production promotion.

Mode B and any clinical/patient-level/external-validation claim remain separately gated by research evidence, not engineering completeness.

See [`MANUAL_GATES.md`](MANUAL_GATES.md) and [`docs/MORNING_SETUP_CHECKLIST.md`](docs/MORNING_SETUP_CHECKLIST.md).
