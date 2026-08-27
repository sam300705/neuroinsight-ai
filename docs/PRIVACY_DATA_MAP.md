# Privacy and Data Map

This is an engineering data inventory, not legal advice or a privacy-compliance claim.

| Data category | Purpose | Storage/retention | Deletion mechanism and boundary |
|---|---|---|---|
| Browser-selected Mode A image | Validation and experimental inference | Sent to the external inference service for processing; not retained by the dashboard by default | The dashboard does not write raw uploads to its database or managed storage. |
| Account identity | Authenticate private history | Platform-managed user table/session | Account controls are platform-managed. |
| Scan record | Reopen a derived research result and list history | Account-linked metadata in the application database | Per-record and delete-all operations remove ownership-scoped metadata. |
| Derived report and Grad-CAM | Optional research-history retrieval | Managed object storage only after consented save | Removing database/key references prevents access through this application. The provider’s helper exposes no physical object delete; this is **access revocation, not verified physical erasure**. |
| Diagnostics | Reliability and security debugging | Privacy-safe operational logs only | Do not record filenames, raw scan bytes, signed URLs, emails, tokens, or storage keys. |
| Optional research explanation request | A bounded question plus de-identified derived research fields (language, purpose, EXP-005 version if present, class, confidence, calibration/manual-review/Grad-CAM flags, uncertainty reason, and fixed unavailable-measurement flag) | Processed by FastAPI; an optional configured provider receives only this allowlist | No raw imaging, preview, Grad-CAM binary, filename, scan/account identifiers, email, URL, storage key, token, secret, or full raw analysis object is forwarded. If no configured provider is available, the existing offline FAQ answers without a provider request. |

## Consent boundary

Mode A upload now requires the user to acknowledge that the selected image is authorised, non-sensitive research material and not patient or personal medical data. This acknowledgement is a browser interaction, not proof of provenance or consent.

## Retention boundary

The current system does not claim a provider-enforced physical-deletion period. Durable artifact persistence must be disabled or moved to a provider with a deletion API before making physical-erasure promises. See [Manual Gates](../MANUAL_GATES.md).

## Explanation-assistant logging boundary

The assistant logs only `provider`, outcome, category, latency, and the bounded request ID for operational debugging. It does **not** log the question, derived context object, provider response, filenames, account data, keys, or tokens. The process-local assistant limiter is a small burst boundary, not a distributed abuse-control guarantee.
