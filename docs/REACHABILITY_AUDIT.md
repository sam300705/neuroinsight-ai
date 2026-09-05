# Reachability Audit

**Audit date:** 2026-08-27

This is a conservative source-level reachability review for the final academic-demo hardening pass. It distinguishes unused product code from framework/runtime modules, which are retained unless a verified product dependency can be removed safely.

| Item reviewed | Finding | Action |
|---|---|---|
| `client/src/components/Volume3DViewer.tsx` and `three` | The Three.js renderer had no product import. The public Mode B path is intentionally unavailable. | Removed the component and the `three` / `@types/three` dependencies. |
| `client/src/components/SegmentationOverlay.tsx` | Results previously imported an inactive-capability component whose prop path could display a mask/measurement when supplied client state. | Removed the import and component. Non-classification Results now render only the explicit unavailable geometry explanation. |
| `client/src/components/Map.tsx` and `@types/google.maps` | No product source import uses the Maps component. | Removed the component and Maps type dependency. |
| `ChatPanel` and Grad-CAM components | Product routes import these components. | Retained. |
| `server/_core/*` integrations | Some modules appear unused by product routes, but are framework-managed and may be reached by platform routing or generated system behavior. | Retained; no speculative deletion. |

The post-removal TypeScript check, Vitest suite, production build, bundle-budget check, and direct source-import scan passed. This audit does not convert any removed component into a capability claim: Mode B remains unavailable pending the separate full-volume evidence and release gate in `docs/OPEN_GATES.md`.
