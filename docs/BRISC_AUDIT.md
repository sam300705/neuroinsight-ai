# BRISC 2025 Audit Record

**Audit date:** 2026-08-23  
**Scope:** User-authorised local research copy only. Raw images and masks remain outside this repository and are not used by the public deployment.

> **Research boundary:** BRISC is a 2D, contrast-enhanced T1 image release. Its publication says original patient and sequence identifiers are unavailable; therefore, all resulting work is image-level research, not patient-independent or clinical validation.[1]

## Source and integrity verification

The downloaded Kaggle archive was obtained only after the user signed into their own account and reviewed the dataset page. The publisher describes BRISC as a four-class 2D MRI classification release with paired binary segmentation masks for tumour images and cites a CC BY 4.0 listing.[1] [2]

| Integrity check | Actual result |
|---|---|
| Manifest records | **15,586** |
| Classification records | **6,000** image records |
| Segmentation records | **9,586** records: **4,793** images plus **4,793** masks |
| Readable images | **10,793 / 10,793** |
| Corrupt or missing image records | **0** |
| `manifest.csv` SHA-256 | Matched the release-side checksum |
| `manifest.json` SHA-256 | Matched the release-side checksum |
| Missing linked images / masks | **0 / 0** |
| Image–mask size mismatches | **0** |

The official classification partition contains 5,000 training images and 1,000 test images. Its recorded class support is shown below.

| Split | Glioma | Meningioma | No tumour | Pituitary | Total |
|---|---:|---:|---:|---:|---:|
| Official train | 1,147 | 1,329 | 1,067 | 1,457 | 5,000 |
| Official test | 254 | 306 | 140 | 300 | 1,000 |

## Duplicate and similarity safeguards

The audit computes exact SHA-256 groups over decoded image files and a broad dHash candidate screen. The dHash output is **not** treated as proof of leakage: a visual check of one broad candidate pair showed two non-identical but generically similar axial MRI images. A stricter follow-up compares normalised grayscale mean absolute error and correlation for dHash candidates.

| Check | Actual result | Action |
|---|---:|---|
| Exact duplicate groups across all tasks | 4,763 | Mostly expected re-use between classification and segmentation task folders. |
| Exact duplicate groups within classification | 46 | Retained as an audit finding. |
| Exact classification train/test duplicate groups | **7** | Exclude corresponding training records. |
| Broad dHash train/test review pairs | 2,456 | Review screen only; not automatic exclusions. |
| Strict cross-split similarity pairs | **131** | Conservative training exclusion applies. |
| Unique training records excluded by exact/strict cross-split evidence | **106** | Omitted from all development manifests. |

## Sanitised research manifests

The official test partition stays untouched. It is not used for model selection, early stopping, calibration choice, or hyperparameter tuning. The development split is generated deterministically from the remaining training candidates while keeping strict similarity groups together.

| Classification manifest | Glioma | Meningioma | No tumour | Pituitary | Total |
|---|---:|---:|---:|---:|---:|
| Sanitised train | 975 | 1,046 | 907 | 1,232 | **4,160** |
| Sanitised validation | 172 | 184 | 160 | 218 | **734** |
| Official untouched test | 254 | 306 | 140 | 300 | **1,000** |

The corresponding paired segmentation manifests contain 3,253 training images, 574 validation images, and 860 official-test images. The 106 segmentation images aligned to excluded classification training records are deliberately unassigned and must not enter training.

## Bounded classifier experiment

`EXP-006` used the sanitised classification manifests to run a CPU-only, three-epoch, ImageNet-initialised ResNet18 head-only experiment at 128 pixels. The checkpoint was selected only by validation macro-F1 at epoch 3, then evaluated once on the untouched official test manifest. It achieved validation accuracy **0.8556** and macro-F1 **0.8566**; the final official image-level test result was accuracy **0.7510**, macro-F1 **0.7501**, and weighted-F1 **0.7513**.

This is an actual separate research result, but it is **not a promotion candidate**. It is lower than the live EXP-005 held-out image-level result, no calibration or ONNX promotion was attempted, and BRISC lacks patient identifiers. The temporary checkpoint remains outside the repository and was not deployed.

## Decision

The **data-integrity gate is passed for separate, carefully limited experimental training preparation**. It does **not** pass a patient-level, external, clinical, or Mode B deployment gate. Any new model must retain the above exclusions, use validation-only selection/calibration, report the untouched official test outcome separately, and remain outside the live application unless an explicit promotion review is completed.

## Reproducibility files

The scripts `ml/audit_brisc.py` and `ml/build_brisc_splits.py` generate the local audit JSON and CSV manifests. Their fixture tests are in `ml/tests/test_brisc_pipeline.py`. The raw dataset and resulting split files are intentionally kept outside Git and deployment directories.

## References

[1] [Fateh et al., “BRISC: Annotated Dataset for Brain Tumor Segmentation and Classification,” *Scientific Data* (2026), DOI: 10.1038/s41597-026-06753-y](https://doi.org/10.1038/s41597-026-06753-y)

[2] [BRISC 2025 dataset page on Kaggle](https://www.kaggle.com/datasets/briscdataset/brisc2025)
