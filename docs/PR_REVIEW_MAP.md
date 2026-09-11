# PR #1 Risk-Based Review Map

This file is a review aid, not an approval. PR #1 is large and GitHub's current PR page is the source of truth for exact commit/file totals. Earlier historical size snapshots in old handovers are not release evidence.

Every changed path has been inventory-classified during the hardening work, but this project does **not** claim a complete human line-by-line semantic audit of every changed line. Automated CI is also not a substitute for human review.

## High-risk review groups

| Group | Primary paths | Review focus |
|---|---|---|
| FastAPI / inference | `backend/neuroinsight_api/**` | fail-closed model loading/readiness, input bounds, signed receipts, report boundary, provider isolation, Mode B rejection |
| Node auth/API/storage | `server/_core/**`, `server/neuroinsight/**`, `server/storage.ts` | authentication/session scope, CSRF, owner predicates, storage-key boundaries, artifact lifecycle/recovery |
| Database | `drizzle/schema.ts`, `drizzle/0002*` through `0006*`, `drizzle/meta/**` | uniqueness, referential integrity, intent durability, migration ordering/preflight |
| Frontend | `client/src/**` | authoritative server-result rendering, no unsafe browser persistence, report availability state, disclaimers, accessibility |
| ML/data | `ml/**`, model/data audit records | provenance, split leakage, image-level claim wording, no accidental Mode B promotion |
| CI/supply chain | `.github/workflows/verify.yml`, lockfiles, Dockerfile | exact-SHA actions, fixed uv, lock enforcement, audits, SBOM, credential-free smoke |
| Documentation | `README.md`, `PROJECT_STATUS.md`, `MANUAL_GATES.md`, `docs/**` | public-vs-preview distinction, exact limitations, migration sequence, no clinical overclaim |

## Final artifact-lifecycle review focus

The final hardening specifically requires reviewers to confirm these invariants together:

1. intent is persisted before upload;
2. finalization accepts only a still-`pending` intent;
3. lock order is scan → intent → artifact for recovery/finalization compatibility;
4. bulk deletion re-reads and locks the exact owned scan/artifact pointers in its transaction;
5. cleanup intents exist before owned metadata deletion commits;
6. provider deletion occurs after DB commit and failures remain durable/retryable;
7. only owner-scoped real provider keys are deleted;
8. legacy `pending:` metadata placeholders are never submitted to provider deletion;
9. automatic sweeps are bounded/non-overlapping and stale uploads receive settle grace;
10. schema migration `0006` restores active metadata referential guards while cleanup intent bookkeeping remains detachable.

## Automated evidence

Application-code baseline `e60272a44cb771624d4c1eff04336cb35843840f` passed workflow run `34526092850` (#196): 260 TypeScript tests, 143 backend tests, 8 ML/data tests, selected coverage gates, production build/bundle, browser accessibility/corruption checks, Node/Python audits, lock validation, SBOM, and container smoke.

The CI-only follow-up `c675b4d` refreshes exact action commit pins to current Node-24-capable releases and pins uv `0.12.13`.

## Repository governance evidence

A fresh read during the final engineering pass reported `main` with `protected: false`; required checks were not enforced by branch protection. This is an owner/repository-settings gate and must be completed before relying on GitHub policy to prevent direct bypass of review/CI.

## Recommended review order

Review FastAPI/inference and Node artifact/auth boundaries first, then migrations, then CI/supply-chain changes, then ML evidence/frontend, and finally public documentation. If the PR must be split for human review, preserve this branch as the audit branch and move only logically independent reviewed slices; do not rewrite history merely to make the diff appear smaller.
