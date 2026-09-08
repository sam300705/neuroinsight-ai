# Authentication boundary review — September 8, 2026

Starting remote head: `fc5ce174e33b562da14c71e406159477a43dd625`.

## Session and identity corrections

A valid signature with the expected issuer/audience previously passed without an
`exp` claim. Verification now explicitly requires expiry and issue time, requires
integer timestamps, and rejects non-positive or greater-than-seven-day lifetimes.
The existing maximum token age and five-second clock tolerance remain enforced.

Missing-user synchronization and cron identity construction now require both
provider `openId` and `projectId` to match the verified session before persistence
or returning an authenticated identity. Negative tests cover both identity axes
and both flows. The existing-user path still avoids per-request writes.

These are local contract checks. Real platform OAuth, preview auto-login, and
cron compatibility require a non-production owner-run lifecycle exercise with
approved credentials; no provider integration success is claimed.

## OAuth transport and schema corrections

OAuth calls now validate a credential-free HTTPS provider URL (HTTP permitted
only on development loopback), refuse redirects, enforce a 30-second total
abort deadline plus Axios timeout, cap requests at 32 KiB and responses at
128 KiB, and discard provider exception details. Runtime schemas validate and
bound token, identity, platform and task fields and omit unknown response keys.
Both access-token and JWT user-info responses must match the configured project.
Codes/access tokens are capped at 8 KiB, session input at 16 KiB, encoded state
at 8 KiB, callback URLs at 2 KiB, and nonces at 16–128 characters. Only the
`/api/oauth/callback` path is accepted for token exchange; the existing browser
nonce/cookie check remains in force. Provider-side registered redirect URI
validation is still required.

Local tests exercise real loopback HTTP success, redirect refusal, malformed and
oversized bodies, non-success status, request bounds, pending-request deadline,
schema rejection and SDK project binding. No real OAuth provider was contacted.
