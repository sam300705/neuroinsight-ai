# Calibration and Uncertainty Evidence

Mode A now has a bounded validation-only experimental calibration record. Mode B has no calibration or full-volume uncertainty evidence. Neither mode is clinically validated.

| Mode | Available experiment evidence | Calibration evidence | Application behaviour |
|---|---|---|---|
| Mode A: 2D four-class classification | EXP-005: ResNet50 experimental run on BDNeuro-MRI V7 sanitized official fixed image-level split, with 882 validation and 889 held-out test images | **Validation-only temperature scaling performed.** Temperature 0.6899; ECE (15 bins) improved from 0.0885 to 0.0251; multiclass Brier score improved from 0.2790 to 0.2660. A 0.55 abstention threshold was selected on validation data with 88.21% validation coverage and 85.35% accepted-sample accuracy. | When configured with the audited checkpoint and calibration record, the service returns a **validation-calibrated experimental model confidence score**, never a medical probability. Scores under 0.55 are labelled low-confidence with manual-review guidance. |
| Mode B: glioma-focused NIfTI segmentation | One bounded 2D whole-tumor selected-slice smoke experiment with case-level separation | **Not applicable as a classification confidence calibration.** Uncertainty behavior and full-volume threshold analysis were not evaluated. | The application returns model-unavailable status and no segmentation mask or quantitative size result. |

> **Interpretation boundary:** The Mode A calibration set remains an image-level validation partition from the same released dataset. It does not establish patient-level, external, prospective, clinical, or medical-probability calibration. A future release candidate still requires a pre-specified calibration set separate from model selection, an external evaluation cohort, and a reviewed clinical-scope protocol.
