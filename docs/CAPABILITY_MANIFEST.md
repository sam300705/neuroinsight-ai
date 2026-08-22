# Canonical Capability Manifest

**Canonical status date:** 2026-08-23. This is the single status reference for public copy, handover records, and release decisions. Update it only after new evidence is verified.

> **Clinical-use restriction:** “This system is not a medical diagnosis and must not replace a qualified radiologist.”

| Capability | Status | Evidence source | Scope boundary |
|---|---|---|---|
| Public dashboard | **Available** | `docs/PUBLIC_HANDOVER.md` | Research and education only. |
| Mode A classification | **Available** | EXP-005 and `docs/TEST_REPORT.md` | Four-class, 2D, fixed-split image-level research classification. |
| Dataset / model | **BDNeuro-MRI v7 / EXP-005** | `DATASET_AUDIT.md`, `EXPERIMENTS.md`, model card | No patient identifiers; no patient-independent claim. |
| Calibration | **Available** | `docs/CALIBRATION_STATUS.md` | Temperature `0.689875`, abstention `0.55`; no medical probability. |
| Grad-CAM | **Available** | Browser/API evidence in `docs/TEST_REPORT.md` | Final-layer attribution only; not a tumour mask. |
| PDF report | **Available** | FastAPI and browser verification | Academic report only; not a clinical report. |
| Consent-based derived history | **Available and verified** | Signed-in retrieval check in `docs/TEST_REPORT.md` | Stores derived PDF/Grad-CAM and anonymous metadata only; never raw upload bytes. |
| Mode B segmentation | **Unavailable by design** | `docs/OPEN_GATES.md` | No full-volume validated model, physical measurements, masks, or 3D result. |
| Last public verification | **2026-08-22** | `docs/VERIFICATION_LOG.md`, `docs/TEST_REPORT.md` | Public dashboard and exact-origin CORS integration checked. |

## Consistency rule

Any document or UI state that calls Mode A unavailable, calls Mode B available, calls Grad-CAM segmentation, or describes a model score as a medical probability is inconsistent with the verified release. The `server/capabilityManifest.test.ts` test and `client/src/contexts/pageCopy.test.ts` regression test enforce the current Mode A/Mode B boundary.
