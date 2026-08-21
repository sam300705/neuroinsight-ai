# Mode A Classification Provenance Update

## Evidence reviewed on 2026-08-21

The prior Mendeley version-1 record, DOI `10.17632/zwr4ntf94j.1`, explicitly identifies a four-class, 12,064-image, pre-processed T1-weighted contrast-enhanced MRI collection under **CC BY 4.0**. Its description provides folder-level train/test counts and contributors, but does not provide a patient/case manifest, original acquisition provenance per file, or evidence that its 80/20 image split is patient-disjoint.

The later maintainer repository links to version 7 and describes a Bangladeshi clinical setting, a rebuild procedure, stratified 70/15/15 image-level splits, and MD5-based zero image-content overlap assertions. These findings establish a potentially improved image-level integrity path but do **not** establish case-level split integrity, individual consent/governance scope, acquisition-level provenance for every file, or external test validity.

## Decision

> The repository and later record are useful leads, but the available public metadata does not yet close the project’s Mode A provenance gate. The project will not train or deploy a final classifier from these files until a versioned patient/case manifest, source-provenance statement, and approved patient-disjoint evaluation protocol are available and reviewed.

The existing exploratory checkpoints remain non-deployed research artifacts. This update does not change the model-unavailable behavior in the dashboard.

## Sources

1. [Mendeley Data version 1 — Brain Tumor MRI Dataset](https://data.mendeley.com/datasets/zwr4ntf94j/1)
2. [Maintainer repository — BDNeuro-MRI documentation](https://github.com/irfanulkabirhira/A-Bangladeshi-Clinical-Brain-Tumor-MRI-Dataset-for-Four-Class-Deep-Learning-Classification/blob/main/README.md)
