# Reproducible Scripts

| Script | Purpose | Raw data policy |
|---|---|---|
| `audit_classification_dataset.py` | Image manifest, integrity checks, class distribution, exact hashes, conservative perceptual-hash candidate list | Reads a local authorized dataset; writes only derived manifests/reports. |
| `audit_nifti_dataset.py` | NIfTI manifest, spacing/orientation checks, case counts, malformed-volume report | Reads a local authorized dataset; writes only derived manifests/reports. |
| `split_manifest.py` | Deterministic patient/case-level train-validation-test split | Refuses to fall back to a row-level split when the grouping column is missing. |
| `summarize_data_audit.py` | Produces a compact duplicate/leakage summary from an audit report | Lets documentation capture the evidence without committing raw-image manifests. |
| `prepare_deduplicated_classification.py` | Creates a deterministic split grouped by exact image hash after a leaked supplied split is rejected | Explicitly marks the output as **not patient-level**; results may not be presented as patient-level performance. |

No download command is included until a candidate’s full provenance and access terms have been checked. Raw data, trained weights, and restricted metadata must remain untracked.
