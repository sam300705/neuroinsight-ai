# Security Threat Model

**Scope:** This is an engineering threat model for the non-clinical research sandbox. It is not a certification, regulatory assessment, or assurance of compliance.

## Assets and trust boundaries

| Asset | Trust boundary | Current protection | Remaining limitation |
|---|---|---|---|
| Browser session | Browser ↔ dashboard | HTTP-only session cookies, same-origin mutation guard, authenticated tRPC procedures | Cookie configuration is platform-managed and requires deployment review. |
| Mode A upload | Browser ↔ external inference service | Browser preflight, bounded FastAPI reads, pixel/mode checks, no raw-upload persistence by default | Public inference still needs a distributed abuse-control deployment design. |
| Derived report/Grad-CAM | Dashboard database ↔ managed storage | Ownership-scoped lookup and freshly issued signed download URL | Storage provider does not expose physical-delete capability. |
| Experiment evidence | Repository ↔ CI | Frozen installs, test/build checks, raw-artifact hygiene guard, dependency audit | CI action SHA pinning and SBOM delivery remain future supply-chain work. |
| Mode B capability | UI ↔ tRPC ↔ inference API | Disabled UI, server-side persistence rejection, public report rejection | Full-volume evidence and release review are intentionally absent. |

## Principal abuse cases

| Abuse case | Mitigation in code | Status |
|---|---|---|
| Cross-site cookie mutation | `csrfSameOriginGuard` rejects cookie-authenticated non-matching or missing origins. | Implemented and unit tested. |
| History IDOR | Artifact lookup joins artifact ownership to the authenticated scan owner before signing. | Implemented and regression tested. |
| Generic storage-key download | Generic `/manus-storage/*` proxy is removed; history exposes artifact IDs only. | Implemented; deployment recovery pending owner publication. |
| Mode B fabrication | Server rejects persistence, artifact registration, and report requests for unavailable segmentation. | Implemented and regression tested. |
| Oversized/decompression-bomb image | Early size checks, bounded reads, pixel limit, and safe image decoding. | Implemented and regression tested. |
| Client-supplied report tampering | No complete server-held inference receipt exists. | **Open manual gate**; do not treat current client-supplied report construction as tamper-proof. |
| Public inference flooding | Local request limits exist; no globally distributed rate limiter is configured. | **Open manual gate**; do not claim abuse resistance. |

## Logging rule

Operational logs must not contain raw image bytes, signed URLs, storage keys, user emails, access tokens, or unbounded user-provided values. Error messages sent to browsers are generic by design.

See [Manual Gates](../MANUAL_GATES.md) for controls requiring owner action.

