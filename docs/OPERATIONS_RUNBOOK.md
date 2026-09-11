# Operations Runbook

## Deploy and rollback

1. Run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build`, backend tests, ML tests, and the production dependency audit.
2. Confirm the pull-request `Verify NeuroInsight AI` workflow is successful.
3. Obtain explicit owner approval before publishing a new managed deployment.
4. After publication, load the dashboard root and analysis route; verify the exact non-diagnostic warning and Mode B unavailable state.
5. If startup or verification fails, use the last known good checkpoint/PR commit rather than rewriting history.

## Current deployment recovery

The managed deployment failed because Express 5 rejects legacy `*` route patterns. Commit `f7dc35f` removes the unsafe generic storage proxy and changes SPA catch-alls to the Express 5 named wildcard form. Local production startup was verified on a temporary port. Publication remains owner-gated.

## Incident response

Do not copy raw scans, storage keys, signed URLs, tokens, or user details into tickets. Record the time, service, generic error class, affected route, and whether an owner-approved rollback was performed. Rotate secrets through the deployment platform only; do not place them in the repository.

