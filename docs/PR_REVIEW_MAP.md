# PR #1 Risk-Based Review Map

This map is a review aid for PR #1, not an approval. **Baseline historical review snapshot:** GitHub reported **44 commits / 142 changed paths** at baseline head `5bbcc69`. **Fresh live-PR evidence snapshot:** GitHub reported **52 commits / 154 changed files** at head `078f6181a0bb61419e9619b4b3b240a52aba399f`. A documentation-only reconciliation commit may advance the live head and commit count, so the GitHub PR remains the source of truth after that point. Every changed path was inventory-classified, but no claim is made that every path received full line-by-line semantic review. Detailed source review concentrated on the high-risk paths below; CI success does not substitute for human review.

| Review group | Files or areas | Risk | Recommended review focus |
|---|---|---:|---|
| FastAPI/inference | `backend/neuroinsight_api/app.py`, `analysis_receipts.py`, `onnx_classifier_runtime.py`, `model_contract.py`, `reporting.py`, request schemas | High | Fail-closed startup, signed receipt claims/expiry/replay scope, report rendering boundary, artifact URL/host/byte/checksum checks, fixed EXP-005 contract, and Mode B rejection. |
| Node API/auth/storage | `server/neuroinsight/scans.ts`, `artifactLifecycle.ts`, `storage.ts`, tRPC CSRF/security modules | High | User ownership predicates, artifact access, deletion order, fresh signed URLs, no raw upload persistence, and mutation origin checks. |
| Database/migrations | `drizzle/schema.ts`, forward migrations and indexes | High | Existing-data compatibility, foreign keys, uniqueness, index use, and rollback/operational consequences. |
| CI/security/deployment | `.github/workflows/verify.yml`, `backend/Dockerfile`, lock files, ignore/hygiene scripts | High | Immutable action references, lock enforcement, dependency audit behavior, SBOM artifact, 3.12 alignment, credential-free container smoke, and no accidental secrets/data. |
| Frontend | `client/src/**` | Medium | Authoritative server result rendering, report receipt transport, disclaimer visibility, no browser provider key or sensitive assistant payload, errors, and accessibility. |
| ML evidence/tooling | `ml/**`, audit/split/training utilities, manifests | High | Provenance, split integrity, no test leakage, image-level wording, fixed EXP-005 deployment boundary, and non-promotion of EXP-006. |
| Documentation | `README.md`, `docs/**`, reports/status records | Medium | Exact URLs/commits, limitations, owner gates, and no clinical or production-readiness overstatement. |
| Generated or derived files | `backend/uv.lock`, `backend/requirements*.lock`, lockfiles and CI SBOM artifact configuration | Medium | Regeneration instructions, provenance from `pyproject.toml`, no manual edits, and review of resolved security updates. |

## Recommended review order

1. Read **FastAPI/inference** and the new report-integrity tests first; report rendering must consume only a valid server-issued Mode A receipt.
2. Review **Node API/auth/storage** and **migrations** together because authorization, artifact references, and deletion behavior cross the database boundary.
3. Review **CI/security/deployment** and generated locks next, including the lock/audit/SBOM/container smoke steps.
4. Review **ML evidence** against the capability manifest and dataset audit before considering a model change.
5. Review frontend transport/accessibility changes and then documentation for accurate public-facing scope.

## Fresh branch-protection evidence

On the fresh read-only check for the `078f6181a0bb61419e9619b4b3b240a52aba399f` evidence snapshot, the GitHub branch-protection endpoint for `main` returned **`404: Branch not protected`**. This is an observed configuration fact, not a request or authorization to change it. Configure branch protection and required review/check policy before any owner merge decision.

## Split strategy

No automatic split, close, recreation, or history rewrite is proposed. The PR is large, but its changes are already organized by focused commits and the current targeted changes add a clear report-integrity/artifact/security group. If reviewers require a split, retain this PR as the audit branch and cherry-pick only reviewed, logically independent groups into new branches; do not make a split a prerequisite for safe review.
