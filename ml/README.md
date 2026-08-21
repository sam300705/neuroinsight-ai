# Machine-Learning Workspace

The machine-learning workspace intentionally begins with data integrity and split tooling rather than a preconfigured weight file. Use `scripts/audit_classification_dataset.py` or `scripts/audit_nifti_dataset.py` to generate a source-specific manifest. Do not train until the manifest documents the selected source, licence, class or mask structure, duplicate findings, and the grouping column required to avoid patient leakage.

```bash
python scripts/audit_classification_dataset.py --input /path/to/dataset --output artifacts/data_audit/classification
python scripts/split_manifest.py --input artifacts/data_audit/classification/classification_manifest.csv --output artifacts/data_audit/classification/split_manifest.csv --group-column patient_id
python scripts/audit_nifti_dataset.py --input /path/to/brats --output artifacts/data_audit/brats
```

The split utility deliberately stops if its requested grouping column is blank. A random image/slice split is not an acceptable fallback when the patient relationship is unknown.

