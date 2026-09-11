# Open Release Gates

The public Mode A classifier is live as a strictly non-clinical, fixed-split **image-level** academic demonstration. It has a real calibrated model-confidence score, Grad-CAM attribution, PDF reporting, and consent-based derived-artifact history. The gates below remain open because enabling them without evidence would create misleading medical-AI behaviour.

| Gate | Current status | Required closure evidence |
|---|---|---|
| Mode A clinical / patient-level claim | **Permanently out of scope for the current release.** EXP-005 has no patient identifier basis and is not externally validated. | Separate patient/case-disjoint and external validation programme, clinical study, and applicable approvals. |
| Mode B model activation | **Unavailable by design.** The old selected-slice 2D smoke work is not full-volume validation. The new case-disjoint NIfTI manifest utility prepares complete image-plus-label cases only; it does not train or activate a model. | Full-volume model, case-disjoint held-out evaluation, uncertainty protocol, artifact verification, and separate release decision. |
| Physical measurement and 3D geometry | **Unavailable.** A 2D classifier Grad-CAM cannot provide anatomy, spacing, size, or volume. | Validated volume mask plus verified spatial metadata and measurement evaluation. |
| New model promotion | **Evidence-gated.** New local experiments must not replace EXP-005 automatically. | Audited data, predefined validation selection, locked-test result, export/ONNX agreement, and owner-approved promotion. |

> The current dashboard remains an academic research application. It must not be used to make medical decisions.
