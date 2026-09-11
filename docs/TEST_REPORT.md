# Verification Report

**Current verification snapshot:** 2026-09-11  
**Scope:** non-clinical academic/research software only.

> **This system is not a medical diagnosis and must not replace a qualified radiologist.**

## Exact application-code baseline

Commit `e60272a44cb771624d4c1eff04336cb35843840f` passed GitHub Actions workflow run `34526092850` (#196) end to end.

| Gate | Result |
|---|---|
| TypeScript | `pnpm check` passed |
| Node/frontend/server tests | **260/260 passed** across 45 Vitest files |
| TypeScript selected coverage | **94.69% statements/lines, 80.52% branches, 100% functions** |
| Production build | passed |
| Initial JS bundle | **477,116 bytes**, below enforced 768,000-byte budget |
| Node production dependency audit | no known vulnerabilities |
| Corrupt-upload browser check | passed; submission blocked before inference |
| Accessibility | primary routes passed axe WCAG 2 A/AA plus keyboard skip-link checks |
| Repository raw-data/secret guard | passed |
| Python lock consistency | passed |
| FastAPI/support tests | **143/143 passed** |
| Python critical coverage | all configured per-module thresholds passed |
| ML/data tests | **8/8 passed** |
| Python dependency audit | no known vulnerabilities |
| Backend SBOM | generated and uploaded by CI |
| Backend container | built and passed credential-free `/health` smoke |

One backend test warning remains upstream/dependency-facing: the installed FastAPI/Starlette test stack warns that the current `httpx`-based TestClient compatibility path is deprecated. It does not fail the suite and is not used as an application-runtime success condition. Dependency changes should be made only against an official compatible stack rather than suppressing this warning blindly.

## Artifact lifecycle coverage

The TypeScript suite covers:

- owner-scoped artifact download/signing boundaries
- rejection of metadata keys outside the authenticated namespace
- incomplete legacy artifact denial
- durable cleanup intent creation before metadata deletion
- cleanup retry on provider failure
- bulk deletion using fresh transaction-locked artifact pointers
- stale-pending commit/cancel reconciliation
- concurrent-finalization preservation
- retry bookkeeping
- legacy `pending:` placeholder compatibility
- final schema/migration invariants for detachable cleanup intents versus protected active metadata
- non-overlapping recovery worker scheduling

## Model/service evidence

Mode A remains EXP-005. Its held-out fixed-split **image-level** accuracy `0.8099`, macro-F1 `0.8080`, and weighted-F1 `0.8110` remain academic evidence only. They are not patient-independent, external, diagnostic, or clinical performance claims.

The exact `e60272a` Vercel inference preview was `READY`. Fresh HTTP 200 probes passed for `/health`, `/ready`, and `/api/v1/model-info`; classification was available and segmentation unavailable. Report generation remained fail-closed without `ANALYSIS_RECEIPT_SECRET`.

No recent runtime errors or unresolved preview toolbar threads were observed during the final engineering pass.

## CI supply-chain follow-up

Commit `c675b4d1960f35518be466c1c7b896b54a2957d7` replaces the older Node-20-targeting action pins with exact commit SHAs for current Node-24-capable releases and pins the uv binary to `0.12.13`, the version already observed to pass the full matrix. This changes CI infrastructure only, not model/application runtime behavior.

## Release boundary

Passing automated tests is not equivalent to production approval or clinical validation. Managed database migration execution, real authentication/signing secrets, physical storage deletion, distributed shared-state behavior, observability, merge/publication/promotion, and any clinical/external validation remain separately controlled gates in `MANUAL_GATES.md`.
