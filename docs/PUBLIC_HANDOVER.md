# NeuroInsight AI — Public Academic Demonstration Handover

**Public dashboard:** <https://neuroaiapp-gtbxy6cw.manus.space>  
**Status:** academic/research demonstration only; **not** a medical device, diagnostic service, or clinical decision-support deployment.

> **This system is not a medical diagnosis and must not replace a qualified radiologist.**

## Release distinction

The existing managed public dashboard is an earlier owner-approved release. PR #1 (`feature/overnight-safe-improvements`) contains a much larger hardening/recovery pass and its Vercel Git deployments are non-production inference previews. CI success and preview readiness do not publish the managed dashboard, merge PR #1, or promote Vercel production.

## Current declared capability

| Component | Status | Scope boundary |
|---|---|---|
| Mode A EXP-005 classification | Available in verified inference preview | Experimental fixed-split image-level research classification only |
| Confidence/calibration/abstention | Available | Model score is not a medical probability |
| Grad-CAM | Available with Mode A | Attribution only; not segmentation |
| PDF report | Fail-closed unless signing configured | Requires server-issued signed analysis receipt and owner secret |
| Private derived history | Implemented | Ownership-scoped pseudonymous result metadata and derived artifacts; source MRI not persisted by history layer |
| Artifact recovery | Implemented in PR #1 | Durable intents, transactional pointer/deletion bookkeeping, automatic/admin reconciliation and retry |
| Research assistant | Offline FAQ by default | External providers configuration-gated |
| Mode B segmentation | Intentionally unavailable | No promoted full-volume case-disjoint model |

## Evidence limits

EXP-005 fixed-split image-level results remain accuracy `0.8099`, macro-F1 `0.8080`, weighted-F1 `0.8110`. They are not patient-independent, external, clinical, diagnostic, or medical-probability evidence.

## Current PR verification

Application-code baseline `e60272a44cb771624d4c1eff04336cb35843840f` passed GitHub Actions run `34526092850` (#196):

- 260 TypeScript/Vitest tests
- 143 FastAPI/support tests
- 8 ML/data tests
- 94.69% selected TypeScript statement/line coverage, 80.52% branches, 100% functions
- all configured Python critical-module coverage gates
- production build and bundle budget
- corrupt-upload and WCAG 2 A/AA browser checks
- Node/Python dependency audits with no known vulnerabilities
- Python lock check, SBOM, and credential-free container smoke

The exact same commit had a `READY` Vercel inference preview. Fresh `/health`, `/ready`, and `/api/v1/model-info` requests returned HTTP 200 with EXP-005 available and Mode B unavailable. Report signing correctly remained unavailable without `ANALYSIS_RECEIPT_SECRET`. No recent preview runtime errors or unresolved toolbar threads were observed during the final engineering pass.

The following CI-only commit `c675b4d` moves external action pins to current Node-24-capable exact SHAs and pins uv `0.12.13`.

## Privacy and artifact handling

The history system does not persist the original MRI upload. Explicitly saved derived artifacts use owner-scoped keys and ownership-gated fresh signed download URLs.

Deletion now records durable cleanup responsibility and removes owned metadata transactionally, then performs real provider deletion outside the database transaction. Provider failure leaves an incomplete cleanup intent for automatic/admin reconciliation. This is stronger than merely revoking application metadata, but provider-side physical erasure must still be demonstrated with a real synthetic managed-storage exercise before making an erasure guarantee.

The artifact lifecycle requires migrations `0004` → `0005` → `0006`. `0006` restores referential guards for active scan/artifact metadata while allowing cleanup intents to outlive a parent long enough to finish cleanup.

## Reports

There are two valid production choices:

1. **Reports enabled:** configure a strong server-only `ANALYSIS_RECEIPT_SECRET`; verify classify → receipt → report plus tamper/expiry/replay rejection before release.
2. **Reports intentionally unavailable:** leave the secret absent and keep all UI/product copy explicit that report generation is unavailable.

## Remaining release controls

Before a new public release, complete the applicable gates in `MANUAL_GATES.md`: branch protection, managed migration execution, real authentication/session signing, storage lifecycle verification, distributed shared state if claimed, observability/retention, and explicit owner merge/publication/promotion decisions.

Mode B remains unavailable until full-volume case-disjoint training/evaluation and separate release evidence exist. Do not infer physical tumour size, volume, or 3D geometry from the current 2D classifier.
