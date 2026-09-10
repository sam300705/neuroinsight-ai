# Canonical Capability Manifest

**Canonical status date:** 2026-09-11. This is the human-readable companion to `release/release-manifest.template.json`. Public copy, handover records, release decisions, and CI release-truth checks must agree with these declared boundaries.

> **Clinical-use restriction:** “This system is not a medical diagnosis and must not replace a qualified radiologist.”

| Capability | Status | Evidence source | Scope boundary |
|---|---|---|---|
| Public dashboard | **Available** | `docs/PUBLIC_HANDOVER.md` | Research and education only. |
| Mode A classification | **Available** | EXP-005, `docs/MODEL_CARD.md`, and `docs/TEST_REPORT.md` | Four-class, 2D, fixed-split image-level research classification. The branch rejects obvious incompatible images, but has no validated MRI-modality/OOD detector. |
| Dataset / model | **BDNeuro-MRI v7 / EXP-005** | `DATASET_AUDIT.md`, `EXPERIMENTS.md`, model card | No patient identifiers; no patient-independent claim. |
| Calibration | **Available** | EXP-005 calibration evidence | Temperature `0.689875`, abstention `0.55`; the model score is not a medical probability. |
| Grad-CAM | **Available** | Browser/API evidence in `docs/TEST_REPORT.md` | Final-layer attribution only; not a tumour mask or causal explanation. |
| Research Trust Lab | **Available** | `docs/RESEARCH_TRUST_LAB.md`, Evidence Ledger, Research Passport | Reproducibility/transparency tooling only; it does not increase the clinical validity of the classifier. |
| Research Passport v1 | **Available** | `client/src/lib/researchPassport.ts`, local verifier tests | Descriptive provenance plus local SHA-256 source matching. The local verifier does not claim to verify a server HMAC receipt. |
| Reliability metrics engine | **Available as research tooling** | `client/src/lib/reliabilityMetrics.ts` | ECE, top-label Brier evidence, Wilson accuracy intervals, and risk-coverage calculations require labeled evaluation samples; they are not clinical guarantees. |
| PDF report | **Receipt-dependent** | FastAPI report/receipt tests | Academic report only; not a clinical report. Without owner-controlled `ANALYSIS_RECEIPT_SECRET`, the guarded report route fails closed. |
| Consent-based derived history | **Available; durable lifecycle code verified** | `docs/ARTIFACT_LIFECYCLE_RECOVERY.md` and lifecycle tests | Raw MRI uploads are not retained by default. Derived cleanup responsibility is recorded durably before metadata deletion; provider deletion happens outside the DB transaction and is retried by reconciliation. Physical provider erasure still requires a real managed-provider exercise. |
| Research Explanation Assistant | **Available as offline FAQ; cloud provider disabled by default** | `backend/neuroinsight_api/research_assistant.py` and provider-mocked tests | Optional explanation only. It cannot modify classifier outputs, activate Mode B, diagnose, or prescribe treatment. |
| Mode B segmentation | **Unavailable by design** | `docs/OPEN_GATES.md` | No accepted full-volume case-disjoint model/evaluation, physical measurements, masks, or 3D result is deployed. |
| Release truth engine | **Available in CI** | `release/release-manifest.template.json`, `scripts/verify-release-truth.mjs` | Detects declaration drift; it does not substitute for external scientific validation or owner deployment gates. |

## Consistency rule

Any document or UI state that calls Mode A unavailable, calls Mode B available, calls Grad-CAM segmentation, describes a model score as a medical probability, claims provider erasure without managed-provider evidence, or promotes a new model without its release evidence is inconsistent with the verified release. `scripts/verify-release-truth.mjs`, `server/capabilityManifest.test.ts`, and `client/src/contexts/pageCopy.test.ts` enforce important parts of this boundary.

## Release rule

Code existence alone does not change an evidence state. A capability can move from unavailable/not-established to available/demonstrated only when its required artifact, evaluation, acceptance gate, and release decision are present and reproducible.
