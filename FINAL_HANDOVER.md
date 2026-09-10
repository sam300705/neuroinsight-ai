# NeuroInsight AI — Final Engineering Handover

**Updated:** 2026-09-11

## Status

The code-owned release-readiness work on `feature/overnight-safe-improvements` is complete to the level that can be verified without owner secrets, billed infrastructure, production promotion, or clinical research evidence.

NeuroInsight AI remains a **non-clinical academic/research demonstration**. It is not a medical device and must not be represented as patient-level, diagnostic, externally validated, or clinically validated software.

> **This system is not a medical diagnosis and must not replace a qualified radiologist.**

## Current implementation

- Mode A classification remains EXP-005 and is the only enabled model capability.
- Mode B segmentation remains intentionally unavailable.
- Derived artifact history is ownership-scoped and consent-controlled.
- Artifact registration uses durable intents, transactional pointer replacement, row locking, owner-scoped keys, and out-of-transaction physical cleanup.
- Automatic artifact reconciliation runs in bounded non-overlapping batches when database and managed-storage configuration are available.
- Stale uploads receive a five-minute settle grace before abandoned-object cleanup.
- Failed cleanup remains durable and is retried with bounded backoff; an admin-only reconciliation procedure is also available.
- Legacy `pending:` metadata placeholders are never sent to physical storage deletion.
- Active scan metadata remains referentially attached to a user and active artifact metadata remains attached to a scan. Only cleanup-intent bookkeeping may outlive its parent record.
- CI is pinned to exact Node-24-capable GitHub Action commits and a fixed uv `0.12.13` binary.

## Verification baseline

Application commit `e60272a44cb771624d4c1eff04336cb35843840f` passed GitHub Actions run `34526092850` / run #196 with:

- `pnpm check`
- **260/260** Vitest tests across 45 files
- TypeScript selected coverage: **94.69% statements/lines, 80.52% branches, 100% functions**
- production Vite/Node build
- initial JS bundle **477,116 bytes**, below the 768,000-byte gate
- production Node dependency audit with no known vulnerabilities
- corrupt-upload browser rejection
- cross-route axe WCAG 2 A/AA and keyboard checks
- raw-data/secret repository guard
- locked Python graph verification
- **143/143** FastAPI/support tests
- all enforced Python critical-module coverage thresholds
- **8/8** ML/data tests
- strict Python dependency audit with no known vulnerabilities
- CycloneDX backend SBOM generation/upload
- credential-free backend Docker build and `/health` smoke test

The subsequent `c675b4d` commit changes CI supply-chain pins only: current Node-24 action commits plus fixed uv `0.12.13`. No model or application runtime behavior is changed by that commit.

## Database migration order

Apply migrations in repository order. Artifact recovery relies on `0004`, `0005`, and corrective `0006` being applied together in sequence on an environment that passes the documented preflight checks.

`0006_restore_referential_guards.sql` is required after `0005_conscious_jocasta.sql`; do **not** stop at `0005`.

See `docs/MIGRATIONS.md` for exact preflight queries and release ordering.

## Deployment evidence

The exact `e60272a` Vercel inference preview reached `READY`. Fresh probes returned HTTP 200 for `/health`, `/ready`, and `/api/v1/model-info`; EXP-005 classification was available and Mode B segmentation unavailable. The report route remained fail-closed because the preview intentionally had no `ANALYSIS_RECEIPT_SECRET`. No recent Vercel runtime errors or unresolved toolbar feedback were observed during the final engineering pass.

This evidence covers the FastAPI inference preview, not publication of the separate managed dashboard.

## External/owner gates still required for a real production release

These are not code defects and cannot be truthfully completed from repository code alone:

1. Protect `main` and require PR/check/review controls. A fresh read still reports `main` unprotected.
2. Apply and verify migrations `0004` → `0005` → `0006` against the managed database after preflight.
3. Configure the platform application identity and a strong server-only `JWT_SECRET`; verify a real non-production authentication lifecycle.
4. If PDF reports remain enabled, configure a strong server-only `ANALYSIS_RECEIPT_SECRET` and verify classify → receipt → report → replay rejection.
5. Perform a managed-provider synthetic save/download/delete/reconciliation exercise and confirm physical deletion.
6. Provision and verify distributed rate/replay state before claiming multi-instance controls.
7. Configure production observability, alert recipients, retention, and staged failure exercises.
8. Obtain a separate owner decision before merging PR #1, publishing a new managed dashboard, or promoting a Vercel production deployment.
9. Keep Mode B unavailable until a lawful full-volume, case-disjoint segmentation model and locked held-out evaluation satisfy its research gates.
10. Do not make clinical/patient-level/external-validation claims without the required independent evidence and review.

## Engineering conclusion

There are no known unchecked code tasks or unresolved inline review threads in the current PR. Automated application verification is green at the recorded baseline, and the release boundaries above are explicit. The project should therefore be described as **code-complete release candidate for its declared non-clinical academic scope**, not as a clinically validated or fully production-approved medical system.
