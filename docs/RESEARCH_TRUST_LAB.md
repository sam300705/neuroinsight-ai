# NeuroInsight AI Research Trust Lab

Last reviewed: 2026-09-11

## Why this layer exists

NeuroInsight AI is an academic, non-clinical research system. Its goal is not to become another generic medical-image viewer or to imply that one confidence score is sufficient evidence. The Research Trust Lab makes the evidence surrounding an experimental result inspectable and portable.

The design follows a 2026 landscape review across medical-imaging tooling and trustworthy-AI literature. It is intentionally described as a differentiated combination, **not** as a claim that no prior system has ever implemented any individual feature.

## Landscape benchmark

### MONAI Label

MONAI Label is strong at AI-assisted annotation, interactive/automatic segmentation, active learning, and model adaptation. It is a labeling and learning platform rather than a result-level reproducibility ledger.

Reference: https://docs.monai.io/projects/label/en/latest/

### OHIF

OHIF is strong at standards-oriented image viewing, measurements, DICOM Structured Reports, measurement tracking, and extensible imaging workflows. NeuroInsight does not attempt to replace this mature viewer stack.

References:

- https://docs.ohif.org/platform/services/data/measurementservice/
- https://docs.ohif.org/user-guide/viewer/measurement-tracking/

### Trustworthy medical-imaging AI literature

Recent reviews emphasize that responsible imaging AI requires more than headline accuracy. Important evidence dimensions include calibrated uncertainty, privacy, explainability, external/subgroup evaluation, robustness, workflow fit, and monitoring. Other work explicitly warns that post-hoc explanation alone does not establish reliability. Uncertainty and OOD detection remain active research areas rather than boxes that should be claimed without validation.

References:

- Responsible AI in medical imaging systematic review: https://pubmed.ncbi.nlm.nih.gov/42535035/
- Uncertainty quantification for AI in medical imaging: https://pubmed.ncbi.nlm.nih.gov/42525278/
- Explainability + uncertainty position paper: https://pubmed.ncbi.nlm.nih.gov/39993336/
- Robust medical OOD detection research: https://pubmed.ncbi.nlm.nih.gov/41344199/
- Conformal prediction overview: https://pubmed.ncbi.nlm.nih.gov/41672654/
- Medical-image registration with conformal uncertainty: https://pubmed.ncbi.nlm.nih.gov/41814074/

## Differentiated product direction

The Trust Lab treats an analysis as an evidence bundle rather than a prediction card.

### 1. Local input fingerprint

The dashboard computes a SHA-256 digest locally from the selected research image. The source `File` and its fingerprint live only in the in-memory analysis session. They are not written to localStorage or sessionStorage.

Purpose:

- identify whether two runs truly used the same bytes;
- improve reproducibility without storing the image;
- make exported research evidence independently matchable to a known source file.

A hash is provenance evidence, not anonymization and not proof that a source image is safe to share.

### 2. Same-input repeatability lab

The user can explicitly request a three-run repeatability check. The dashboard sends the exact same in-memory file to the existing Mode A endpoint three times and compares:

- predicted class;
- analysis status;
- calibration flag;
- model confidence score drift.

The check does not save these reruns to application history. A pass means the currently deployed inference path produced the same decision within the configured numerical tolerance for those repeated requests. It does **not** establish robustness to scanner, protocol, demographic, institution, noise, acquisition, or distribution shift.

### 3. Versioned Research Passport

Each current result can be exported as `neuroinsight-research-passport/v1` JSON. The portable capsule contains:

- request and scan identifiers;
- input filename, byte size, and local SHA-256 when available;
- model version and inference status;
- prediction and model confidence score;
- calibration and abstention state;
- manual-review flag;
- Grad-CAM availability;
- integrity-receipt availability;
- measurement capability state;
- repeatability evidence when run;
- server warnings and technical limitations;
- explicit non-claims.

The passport is descriptive research provenance. It is not a clinical report, a regulatory record, or a cryptographic signature by itself. When the backend issues an `analysis_receipt`, that server receipt remains the integrity mechanism used by the report flow.

### 4. Evidence-gap ledger

The UI deliberately displays safeguards that are not currently established:

- validated OOD detection;
- conformal coverage guarantees;
- external/prospective clinical validation;
- segmentation and physical volumetry in Mode A.

This is a product feature, not merely a disclaimer. It prevents the interface from collapsing model trust into one confidence percentage.

## Next research upgrades that require new evidence

These ideas should be implemented only after their evaluation protocols and datasets exist:

1. **Perturbation stability** — validated image-preserving perturbation suite with attribution and prediction stability metrics.
2. **OOD / shift detector** — trained and evaluated against declared in-distribution and shifted cohorts; do not infer OOD from ad-hoc brightness or entropy thresholds.
3. **Conformal prediction sets** — only after a sufficiently large, independent calibration set is declared and coverage is measured for the intended scope.
4. **Explanation stability** — quantitative comparison of attribution maps under controlled perturbations, not visual inspection alone.
5. **Subgroup/fairness evidence** — only if lawful dataset metadata supports defensible subgroup analysis.
6. **Mode B uncertainty maps** — only after a real full-volume segmentation model and case-disjoint evaluation exist.
7. **Standards interoperability** — DICOM/DICOM-SR/FHIR integrations should use mature standards-oriented tooling rather than a proprietary approximation.

## Product rule

A future feature must not move from `not established` to `available` because code exists. It moves only when the corresponding artifact, evaluation, and acceptance gate are present and reproducible.
