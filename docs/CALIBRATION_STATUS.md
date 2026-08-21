# Calibration and Uncertainty Evidence

No deployed model calibration curve, expected calibration error, Brier score, or abstention threshold exists for either NeuroInsight mode. This is an explicit research-safety finding rather than missing documentation.

| Mode | Available experiment evidence | Calibration evidence | Application behaviour |
|---|---|---|---|
| Mode A: 2D four-class classification | Two small head-only development smoke experiments on a non-patient-level exact-hash grouped split | **Not performed.** The source provenance/evaluation limitations prohibit threshold selection or a clinical-style probability claim. | The application returns model-unavailable status and never surfaces a model confidence score. |
| Mode B: glioma-focused NIfTI segmentation | One bounded 2D whole-tumor selected-slice smoke experiment with case-level separation | **Not applicable as a classification confidence calibration.** Uncertainty behavior and full-volume threshold analysis were not evaluated. | The application returns model-unavailable status and no segmentation mask or quantitative size result. |

> A future release candidate requires a pre-specified calibration set that is separate from model selection, a documented calibration method, confidence/reliability metrics, an abstention policy fixed before testing, and an untouched external evaluation cohort. Until then, any raw output remains a research model score rather than a medical probability.

