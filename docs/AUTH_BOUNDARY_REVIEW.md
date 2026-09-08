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
