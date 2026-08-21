# Security and Privacy Evidence

This record describes the controls implemented in the project and the verification evidence available as of 2026-08-21. It does not claim formal security certification, HIPAA compliance, or clinical-system authorization.

| Control | Implementation evidence | Verification evidence |
|---|---|---|
| Raw scan retention boundary | `scan_records` stores metadata JSON, not raw scan bytes. The storage registration procedure accepts only derived report, Grad-CAM, mask, or geometry artifact types. | Schema review and typed artifact-registration tests passed. |
| Account isolation | Scan list, result persistence, artifact registration, and deletion routes use authenticated procedures and scope records by `ctx.user.id`. | TypeScript verification passed; route code reviewed. |
| Destructive-action protection | Delete-all accepts only the literal `DELETE_ALL_RESEARCH_HISTORY`; the UI requires the phrase before enabling the control. | Server validation test and UI implementation reviewed. |
| Artifact boundary | Stored objects use returned storage keys/URLs; no predicted key is trusted. Raw upload files are not sent through the artifact procedure. | Storage-helper contract and registration validation tests passed. |
| Upload safeguards | Client checks extension, MIME, size, image signature/decode, and NIfTI/gzip headers. The FastAPI service rejects invalid payloads in its upload-validation tests. | 4 upload-validator tests and FastAPI tests passed. |
| Scope and decision safeguards | Global academic disclaimer, persistent Grad-CAM and glioma-scope controls, unavailable-model status, and safe chatbot refusal paths are implemented. | Desktop/mobile visual checks and FastAPI/chat tests passed. |

The remaining risk is operational integration: a separately hosted inference service, model artifacts, and artifact transport must receive security review before a model-enabled deployment. The dashboard’s current model-unavailable behavior is an intentional protective gate.

