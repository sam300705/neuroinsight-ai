# Security and Privacy Evidence

This record describes the controls implemented in the project and the verification evidence available as of 2026-08-23. It does not claim formal security certification, HIPAA compliance, or clinical-system authorization.

| Control | Implementation evidence | Verification evidence |
|---|---|---|
| Raw scan retention boundary | `scan_records` stores metadata JSON, not raw scan bytes. The storage registration procedure accepts only derived report, Grad-CAM, mask, or geometry artifact types. | Schema review and typed artifact-registration tests passed. |
| Account isolation | Scan list, result persistence, artifact registration, and deletion routes use authenticated procedures and scope records by `ctx.user.id`. | TypeScript verification passed; route code reviewed. |
| Destructive-action protection | Delete-all accepts only the literal `DELETE_ALL_RESEARCH_HISTORY`; the UI requires the phrase before enabling the control. | Server validation test and UI implementation reviewed. |
| Artifact boundary | Stored objects use returned storage keys/URLs; no predicted key is trusted. Raw upload files are not sent through the artifact procedure. | Storage-helper contract and registration validation tests passed; signed-in retrieval was verified with a temporary derived-only record. |
| Upload safeguards | Client checks extension, MIME, size, image signature/decode, and NIfTI/gzip headers. The FastAPI service rejects invalid payloads in its upload-validation tests. | Upload-validator tests and FastAPI tests passed. |
| Scope and decision safeguards | Persistent academic disclaimer, Grad-CAM boundary, Mode B unavailable state, and safe chatbot refusal paths are implemented. | Desktop/mobile visual checks and FastAPI/chat tests passed. |

The remaining operational research risk is any future model change or Mode B activation. Every new artifact and hosting path requires security review before promotion. The live Mode A service remains limited to the verified experimental academic scope in `docs/CAPABILITY_MANIFEST.md`.
