# Owner Setup / Release Checklist

Use this checklist only when preparing an environment beyond the credential-free CI/research preview. Never paste secrets, patient data, or private medical images into repository issues, PR comments, or logs.

> **This system is not a medical diagnosis and must not replace a qualified radiologist.**

## 1. Repository safety

- [ ] Protect `main`.
- [ ] Require PR review and the `verify` workflow before merge.
- [ ] Require conversation resolution where appropriate.
- [ ] Disallow force pushes/deletion on the protected branch unless deliberately required by repository policy.

## 2. Database

- [ ] Take a managed DB backup/snapshot.
- [ ] Run all three orphan/null preflight queries in `docs/MIGRATIONS.md`.
- [ ] Apply artifact-lifecycle migrations in order: `0004` → `0005` → `0006`.
- [ ] Re-run preflight/integrity checks after migration.
- [ ] Confirm the application can start with the migrated schema.

## 3. Dashboard authentication

- [ ] Confirm the real platform-provided `VITE_APP_ID`.
- [ ] Configure a cryptographically random server-only `JWT_SECRET` with at least 32 UTF-8 bytes.
- [ ] Verify the secret is absent from browser bundles and logs.
- [ ] Verify sign-in, cross-application rejection, expiry, logout, and restart behavior in non-production.

## 4. Reports

Choose deliberately:

- [ ] **Reports enabled:** configure strong server-only `ANALYSIS_RECEIPT_SECRET`, then verify classify → receipt → report and tamper/expiry/replay rejection.
- [ ] **Reports disabled:** keep the secret absent and ensure product copy/UI does not promise an available report.

## 5. Managed artifact storage

Using only synthetic/non-patient content:

- [ ] Save one derived artifact.
- [ ] Replace the same artifact type and verify the old object is cleaned.
- [ ] Download through the ownership-gated fresh signed URL.
- [ ] Delete the scan/history record.
- [ ] Verify the physical provider object can no longer be fetched.
- [ ] Simulate or observe one cleanup failure, run/wait for reconciliation, and verify the durable intent eventually becomes complete.

## 6. Shared controls for multi-instance deployment

If claiming production-wide rate limits or receipt replay protection:

- [ ] Provision approved managed shared state such as the documented Redis path.
- [ ] Configure server-only credentials.
- [ ] Set `REQUIRE_DISTRIBUTED_CONTROLS=true`.
- [ ] Verify cross-instance limiting/replay behavior, shared-state outage 503/fail-closed behavior, retention, and spend alerts.

Otherwise, document that process-local fallback is the active boundary.

## 7. Observability

- [ ] Define SLOs and paging recipients.
- [ ] Configure approved runtime-log alerting or a protected log drain.
- [ ] Define retention.
- [ ] Trigger a synthetic 5xx and latency breach.
- [ ] Verify alert delivery and that logs omit request content, credentials, provider bodies, patient data, and raw exceptions.

## 8. Inference preview/release verification

- [ ] `/health` returns 200.
- [ ] `/ready` returns 200 only when the intended Mode A path is ready.
- [ ] `/api/v1/model-info` identifies EXP-005 and segmentation as unavailable.
- [ ] Malformed/corrupt/obvious-non-MRI probes fail safely.
- [ ] One lawful non-patient research input exercises the intended inference path before production promotion.
- [ ] Verify configured CORS origins and rejection of an unrelated origin.

## 9. Research boundaries

- [ ] Keep Mode B unavailable unless full-volume case-disjoint research/evaluation gates are completed.
- [ ] Do not infer physical tumor size/volume/3D geometry from the 2D classifier.
- [ ] Do not present image-level EXP-005 metrics as patient-independent, diagnostic, external, or clinical validation.
- [ ] Review source-data terms before any new training/evaluation run.

## 10. Release decisions

These actions require an explicit owner choice; do not infer them from CI success:

- [ ] Merge PR #1.
- [ ] Publish a new managed-dashboard version.
- [ ] Promote a Vercel production deployment.
- [ ] Review legal/privacy wording before public reliance.
