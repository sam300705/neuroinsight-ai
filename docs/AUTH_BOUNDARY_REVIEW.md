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

## History response correction

History listing validates stored result fields against the accepted write schema,
checks stored boolean flags/timestamps, caps stored JSON parsing, and returns only
an explicit public projection. Raw JSON and internal owner fields no longer leak
through object spreading. Invalid rows are omitted with a visible warning; the raw
page cursor is retained. A rendered-component regression verifies the Next button
stays enabled on an all-corrupt page. Delete-all resets pagination and search input
matches the API's 64-character limit.

## HTTP and browser error correction

The Node dashboard now returns JSON 404 for unknown `/api` paths before SPA
fallback. Its final error middleware maps parser failures to fixed 400/413/415
responses and unexpected failures to fixed 500 responses. Existing security
headers remain present. Tests exercise actual Express HTTP requests and verify
successful API and SPA paths continue working. Browser query/mutation failures
log fixed operation labels only; the existing unauthorized login transition is
preserved and tested. Both new error modules join the coverage gate.

## Managed-storage transport correction

Storage control URLs require credential-free HTTPS and reject query strings,
fragments, whitespace and backslashes before sending the bearer token. Signed
object URLs allow signature queries but reject fragments and credentials. All
storage fetches refuse redirects, signing responses are capped at 64 KiB during
streaming, and network/parse failures omit provider details. Discarded response
bodies are cancelled and reader locks released. Object keys are capped at the
512-character database contract. Existing 10/30-second deadlines remain active.

This does not fix artifact registration's object/database atomicity gap. Durable
upload-intent and cleanup bookkeeping, immutable attempt keys, transactional
metadata replacement and ambiguous-commit recovery are still required. A simple
catch-and-delete is unsafe: the database may have committed before the client
received an error. Provider deletion and recovery must be integration-tested
before making durability or physical-erasure guarantees.
