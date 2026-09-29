# Future Public Data Sourcing — Research Gate

**Purpose.** This document is a data-planning shortlist for future research only. It does not authorise scraping hospital websites, collecting patient scans or DNA, downloading controlled data, combining datasets, retraining a model, or changing the deployed system. The live NeuroInsight AI service remains a strictly non-clinical Mode A academic demonstration.

> **Rule:** Data from hospitals may be used only when the hospital has formally approved the research, applicable ethics/IRB review is complete, a data-sharing agreement is in place, and a qualified privacy/governance process confirms de-identification. Public availability of a hospital website is **not** permission to collect patient data.

## What “authenticate the data” means

For this project, data authentication does **not** mean DNA authentication. It means confirming that a dataset is real, traceable, lawful to use, and suitable for its specific research task. Before any future download, the team must record the official dataset page and DOI, licence or access agreement, data version, checksum where supplied, de-identification statement, imaging format, labels and annotation method, institution/source information, patient or study identifiers, and known overlap with other collections.

## Authoritative public-source shortlist

| Source | What the official source says | Potential research use | Important boundary |
|---|---|---|---|
| **UCSF-PDGM, TCIA** | The current release identifies **495** true patients with pre-operative diffuse glioma MRI; it supplies skull-stripped, de-identified NIfTI data, expert-reviewed tumour sub-region labels, and CC BY 4.0 terms.[1] | A strong candidate for a future **full-volume glioma segmentation** study. | It is mainly from one medical centre, so it cannot establish broad generalisation alone. TCIA specifically notes mappings that must be checked to prevent overlap with BraTS.[1] |
| **BraTS challenge data** | The official challenge describes multi-institutional pre-operative mpMRI from **19 institutions**, expert-reviewed tumour-region labels, NIfTI volumes, and registration/data-request access.[2] | A benchmark-style segmentation development and hidden-evaluation plan. | Access must follow the stated registration and data-use requirements. It is not an automatic download or an automatic approval for clinical deployment.[2] |
| **BraTS-Africa, TCIA** | This release describes **146** patients from six Nigerian diagnostic centres, de-identified and de-faced mpMRI volumes, expert-annotated sub-regions, scanner metadata, and a mixture of CC BY 4.0 and limited-access assets.[3] | A possible future diversity and external-evaluation cohort for glioma segmentation. | Some original/unprocessed assets are limited access. The team must use only the permitted release, follow TCIA policy, and keep this cohort separate for external testing where justified.[3] |
| **Brain Tumor Connectomics Data, OpenNeuro** | The official record describes 11 glioma, 14 meningioma, and 11 control participants with masks, and requires agreement not to attempt re-identification.[4] | A small, carefully governed exploratory or external pilot cohort. | It is too small for a flagship training dataset and does not cover the project’s complete four-class scope.[4] |

## Safe research path

| Step | Required action | Must not happen |
|---|---|---|
| 1. Dataset register | Create a versioned register containing DOI, access date, licence/terms, source institution(s), modalities, labels, subject/study identifiers, overlap risks, and intended use. | Do not merge folders because their names look similar. |
| 2. Legal and privacy check | Read the complete official access terms and, where required, complete registration through the official channel. Preserve only the minimum permitted de-identified data. | Do not scrape hospital pages, contact patients, try to re-identify participants, or use DNA/genetic details outside the permitted research question. |
| 3. Data-quality audit | Check readable volumes, modality completeness, image geometry, label integrity, annotation protocol, scanner/site distribution, duplicates, and patient/study overlap. | Do not treat a supplied label as automatically correct or assume two datasets are independent. |
| 4. Correct split design | Split at patient level; hold out an entire external site or collection where feasible; freeze the test set before model selection. | Do not mix slices or repeated scans from one patient across train and test. |
| 5. Mode B research | Train and validate a full-volume segmentation model only after the audit, then report Dice/IoU, uncertainty, failure cases, and measurement validation. | Do not activate masks, tumour size, volume, or 3D output until the model and evaluation evidence are complete. |
| 6. Clinician study | Work with a hospital research partner to define intended use, reader study, success/failure criteria, workflow testing, privacy review, and ethics/governance approvals. | Do not describe the website as usable for patient diagnosis before these studies and applicable approvals. |

## Recommendation for the current project

Do **not** add any new dataset directly to the deployed project today. The safest next research step is a documented feasibility study for a separate Mode B segmentation dataset, beginning with the official UCSF-PDGM and BraTS terms. Before any download or training, verify overlap, licence/access obligations, and the research objective. Keep a possible external cohort—such as BraTS-Africa—out of model development until a pre-specified evaluation protocol is approved.

This sequence produces stronger evidence than searching every hospital website. It is lawful, reproducible, and easier to explain in a college viva.

## References

[1] [The Cancer Imaging Archive — UCSF Preoperative Diffuse Glioma MRI (UCSF-PDGM), DOI: 10.7937/tcia.bdgf-8v37](https://www.cancerimagingarchive.net/collection/ucsf-pdgm/)

[2] [CBICA — Multimodal Brain Tumor Segmentation Challenge 2020: Data](https://www.med.upenn.edu/cbica/brats2020/data.html)

[3] [The Cancer Imaging Archive — BraTS-Africa, DOI: 10.7937/v8h6-8x67](https://www.cancerimagingarchive.net/collection/brats-africa/)

[4] [OpenNeuro — Brain Tumor Connectomics Data (ds001226)](https://openneuro.org/datasets/ds001226/versions/5.0.1)
