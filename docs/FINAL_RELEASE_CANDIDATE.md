# Final Release-Candidate Record

**Date:** 2026-09-11

## Engineering disposition

For the declared **non-clinical academic/research scope**, all currently identified code-owned blockers have been implemented or explicitly fail-closed. `todo.md` contains no unchecked task items and PR #1 has no unresolved inline review threads as of this record.

The last fully completed application-code verification baseline is commit `e60272a44cb771624d4c1eff04336cb35843840f`, GitHub Actions run `34526092850` (#196): **260 TypeScript tests, 143 backend tests, 8 ML/data tests**, production build/bundle, browser accessibility/corrupt-upload checks, dependency audits, locked Python graph, SBOM, and Docker health smoke all passed.

The inference preview for the same commit was `READY`, with fresh 200 responses for health/readiness/model-info, EXP-005 classification available, Mode B unavailable, report signing fail-closed without its secret, and no observed recent runtime errors or unresolved preview feedback.

CI supply-chain maintenance was then hardened at `c675b4d1960f35518be466c1c7b896b54a2957d7`: every external action remains exact-SHA pinned but now points to a current Node-24-capable release, and uv is fixed to `0.12.13` instead of floating to `latest`.

## Artifact lifecycle disposition

The final code includes:

- durable attempt/cleanup intents
- immutable owner-scoped provider keys
- scan→intent→artifact lock ordering
- transactional active-pointer replacement
- transaction-locked single/bulk deletion snapshots
- physical storage network calls outside DB transactions
- automatic and admin-triggered reconciliation
- stale-upload settle grace
- retry/backoff
- legacy placeholder compatibility
- restored active metadata referential guards through migration `0006`

## Required schema sequence

`0004_equal_captain_flint.sql` → `0005_conscious_jocasta.sql` → `0006_restore_referential_guards.sql`.

Stopping at `0005` is not the final schema. See `docs/MIGRATIONS.md` before applying anything to a managed database.

## Non-code gates

This record deliberately does not claim completion of branch protection, real secrets, managed database migration execution, storage-provider physical erasure, distributed shared controls, operational alerting, owner release decisions, full-volume Mode B research, or clinical/external validation. Those gates are listed in `MANUAL_GATES.md`.

## Safety boundary

NeuroInsight AI must continue to be presented as experimental academic software. **This system is not a medical diagnosis and must not replace a qualified radiologist.**
