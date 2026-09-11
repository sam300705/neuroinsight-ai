# NeuroInsight AI — Project Status

**Last updated:** 2026-09-11  
**Engineering status:** **Code-complete release candidate for the declared academic scope**  
**Product/clinical status:** **Level 1 — functional non-clinical academic demonstration**

> **This system is not a medical diagnosis and must not replace a qualified radiologist.**

## Capabilities

| Capability | Status | Verified boundary |
|---|---|---|
| Mode A four-class 2D classification | **Available** | Experimental fixed-split image-level classification only. |
| Mode A model | **EXP-005** | ResNet50 head-only academic classifier. |
| Calibration / abstention | **Available** | Validation-derived temperature/threshold; displayed score is not a medical probability. |
| Grad-CAM | **Available with Mode A** | Classifier attribution, not segmentation or a tumor boundary. |
| PDF report | **Fail-closed unless signing configured** | Requires the server-side analysis receipt signing contract. |
| Private derived-artifact history | **Implemented** | Account-linked pseudonymous metadata plus derived artifacts only; source MRI pixels are not persisted by this history layer. |
| Artifact recovery | **Implemented** | Durable intents, transactional replacement/deletion bookkeeping, automatic bounded reconciliation, retry/backoff, and admin reconciliation. |
| Research assistant | **Offline fallback available** | External providers remain opt-in/configuration-gated. |
| Mode B segmentation | **Unavailable by design** | No promoted full-volume case-disjoint segmentation model exists. |

## Current verification evidence

The final application-code baseline `e60272a44cb771624d4c1eff04336cb35843840f` passed GitHub Actions run `34526092850` (#196):

- 260 TypeScript/Vitest tests across 45 files
- 143 FastAPI/support tests
- 8 ML/data tests
- TypeScript selected coverage 94.69% statements/lines, 80.52% branches, 100% functions
- all configured Python critical coverage thresholds
- production build and bundle gate
- browser corrupt-upload and WCAG 2 A/AA route checks
- Node and Python production dependency audits with no known vulnerabilities
- Python lock check and SBOM generation
- backend Docker build and credential-free health smoke

The exact `e60272a` Vercel inference preview was `READY`; `/health`, `/ready`, and `/api/v1/model-info` returned HTTP 200 with EXP-005 available and segmentation unavailable. Report signing remained intentionally unavailable without `ANALYSIS_RECEIPT_SECRET`.

CI was subsequently hardened at `c675b4d` with exact Node-24-capable action commit pins and uv `0.12.13`; this is a CI-only supply-chain change.

## Artifact/data lifecycle state

Migrations `0004`, `0005`, and `0006` collectively define the durable artifact-intent model. `0006_restore_referential_guards.sql` is mandatory after `0005`: active scan metadata is tied to users, active artifact rows are tied to scans, while cleanup-intent rows may survive parent deletion long enough to finish physical cleanup.

The application no longer relies on deleting provider objects inside database transactions. Deletion first records durable cleanup work and removes owned metadata transactionally, then performs provider deletion outside the transaction. Failed cleanup remains discoverable and retryable.

## Research evidence

EXP-005 held-out fixed-split **image-level** results remain accuracy `0.8099`, macro-F1 `0.8080`, weighted-F1 `0.8110`. These are not patient-independent, external, diagnostic, or clinical performance claims.

The bounded BRISC EXP-006 experiment did not meet the separate promotion bar and was not deployed. Mode B remains unavailable until full-volume case-disjoint research and release gates are satisfied.

## Remaining non-code release gates

See `MANUAL_GATES.md`. The key unresolved boundaries are repository branch protection, managed database migration execution, real authentication/signing configuration, managed storage lifecycle verification, distributed shared-state provisioning if required, observability/alerts, and separate owner approval for merge/publication/production promotion.
