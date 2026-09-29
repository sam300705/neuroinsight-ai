# Live demo investigation — September 8, 2026

## Observed failure and recovery

The public dashboard at https://neuroaiapp-gtbxy6cw.manus.space/ loaded its
homepage. Clicking **Analyse scan** failed with a dynamic import error for
`/assets/Analyse-CBDeifhV.js`, shown inside the old generic error boundary.
Clicking **Reload Page** recovered `/analyse`; subsequent Overview → Analyse
navigation succeeded. The entry script remained `/assets/index-BQc-rgKQ.js`.
This establishes a recoverable chunk-fetch failure, not a proven deployment
version mismatch. CDN/network origin diagnostics from the Manus host were not
available through the connected GitHub/Vercel integrations.

The Vercel production API is a separate service. Its deployment
`dpl_4bGrp7jyDjFGmPcmZHL3BNtDxKga` remains READY at main `26498b5`.
Authenticated connector probes returned HTTP 200 for `/health`, `/ready`, and
`/api/v1/model-info`. Classification was available, segmentation unavailable.
The API root returned 404, which is expected because it does not host the
React dashboard. Recent production 404 log counts were for `/` and `/favicon.ico`.
These checks did not submit an image or validate model accuracy.

## Repository fix

- Retry a recognized route-chunk fetch failure once after 300 ms, with no page
  reload or unbounded retry loop; unrelated application exceptions are not retried.
- Serve HTML and unhashed files with `Cache-Control: no-store` and content-hashed
  assets with immutable caching. Missing `/assets` files return non-cacheable
  text 404, never the SPA HTML shell.
- Replace the raw stack trace with an actionable recovery message. Reloading
  requires an explicit button click and warns that unsaved analysis is cleared.
- Tests cover transient recovery, permanent failure, application exceptions,
  production HTTP cache/content-type behavior, and privacy of the fallback UI.

## Publication boundary and owner action

Pushing PR #1 creates a Vercel **backend preview**, not a new Manus dashboard.
The live browser recovered using the existing public release; the repository
fix has not been published to that host. Apply the verified dashboard build
through the existing Manus project after its session/OAuth configuration gates
and publication decision. Preserve content-hashed assets across a rolling
release where the hosting platform supports it; do not disable security controls
or rotate secrets to address an asset-loading failure.

After publication, check homepage → Analyse → Results → History navigation,
reload `/analyse`, verify HTML is not cached and a deliberately missing
`/assets/nonexistent.js` returns 404, and repeat the existing corrupt-upload and
accessibility checks. Do not promote the unrelated API merely to fix dashboard
assets.
