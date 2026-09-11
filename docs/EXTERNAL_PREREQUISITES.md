# External Prerequisites for Future Evidence-Gated Work

Mode A is already available as a non-clinical academic demonstration. Its public integration, calibration evidence, report generation, exact-origin CORS policy, and signed-in derived-artifact retrieval were verified. This document lists **future** prerequisites only; it does not describe Mode A as unavailable.

| Future capability | Required external evidence or action | Why it remains separate from the current release |
|---|---|---|
| Patient-level or clinical claim | Patient/case identifiers, legally permitted data, patient-disjoint and external evaluation, intended-use study, and applicable governance/approval. | The current Mode A source lacks a patient-level separation basis. |
| Mode B full-volume segmentation | A permitted full-volume dataset, case-disjoint protocol, full-volume model/evaluation, uncertainty and failure analysis, artifact checks, and release review. | The present old smoke experiment cannot support a real segmentation service. |
| Additional public datasets | Owner-reviewed provider terms, version/manifest evidence, provenance audit, and overlap checks. | No user may accept dataset agreements on another person’s behalf. |
| High-resource segmentation compute | Explicitly authorised compute/hosting appropriate to the workload. | Free serverless ONNX hosting is appropriate for current Mode A, not a full 3D segmentation stack. |

> No feature, upload check, report, model score, or visualization in this project is evidence of certification as a medical device or diagnostic system.
