# Canonical Capability Manifest

**Canonical status date:** 2026-08-27. This is the single status reference for public copy, handover records, and release decisions. Update it only after new evidence is verified.

> **Clinical-use restriction:** “This system is not a medical diagnosis and must not replace a qualified radiologist.”

| Capability | Status | Evidence source | Scope boundary |
|---|---|---|---|
| Public dashboard | **Available** | `docs/PUBLIC_HANDOVER.md` | Research and education only. |
| Mode A classification | **Available** | EXP-005 and `docs/TEST_REPORT.md` | Four-class, 2D, fixed-split image-level research classification. |
| Dataset / model | **BDNeuro-MRI v7 / EXP-005** | `DATASET_AUDIT.md`, `EXPERIMENTS.md`, model card | No patient identifiers; no patient-independent claim. |
| Calibration | **Available** | `docs/CALIBRATION_STATUS.md` | Temperature `0.689875`, abstention `0.55`; no medical probability. |
| Grad-CAM | **Available** | Browser/API evidence in `docs/TEST_REPORT.md` | Final-layer attribution only; not a tumour mask. |
| PDF report | **Verified on earlier public recovery; receipt-dependent in current PR** | Historical FastAPI/browser verification and current receipt tests | Academic report only; not a clinical report. A future PR #1 release needs owner-controlled `ANALYSIS_RECEIPT_SECRET`, otherwise the route fails closed with `503` and the branch UI offers no report action. |
| Consent-based derived history | **Available and verified** | Signed-in retrieval check in `docs/TEST_REPORT.md` | Stores account-linked pseudonymous metadata and derived Mode A PDF/Grad-CAM only; never raw upload bytes, storage keys, or durable download URLs. |
| Research Explanation Assistant | **Available as offline FAQ; cloud provider disabled by default** | `backend/neuroinsight_api/research_assistant.py` and provider-mocked tests | Server-side optional explanation only. It cannot modify results or activate Mode B; no production provider key is configured. |
| Mode B segmentation | **Unavailable by design** | `docs/OPEN_GATES.md` | No full-volume validated model, physical measurements, masks, or 3D result. |
| Last public verification | **2026-08-26** | `docs/VERIFICATION_LOG.md`, `docs/TEST_REPORT.md` | Owner-approved public dashboard recovery, sign-in boundary, public Mode A inference, and Mode B unavailability checked. |

## Consistency rule

Any document or UI state that calls Mode A unavailable, calls Mode B available, calls Grad-CAM segmentation, or describes a model score as a medical probability is inconsistent with the verified release. The `server/capabilityManifest.test.ts` test and `client/src/contexts/pageCopy.test.ts` regression test enforce the current Mode A/Mode B boundary.
