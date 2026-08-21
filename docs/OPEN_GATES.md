# Open Release Gates

The following items intentionally remain incomplete. They are retained as explicit gates because completing them without the stated evidence would create misleading medical-AI behavior.

| Gate | Why it remains open | Required closure evidence |
|---|---|---|
| Mode A model activation | Current classification source has unresolved provenance and lacks a patient-level evaluation split. | Provenance-approved source, locked patient-level split, calibration study, held-out/external performance record. |
| Mode B model activation | Current model is a small selected-slice 2D smoke experiment, not full-volume validation. | Full-volume model and evaluation, uncertainty protocol, clinical-scope review, approved artifacts. |
| Model confidence display | No calibrated model is approved. | Reliability evidence and an abstention threshold fixed before testing. |
| Automatic report/history artifacts | Report and object-reference code is ready, but there is no approved model-enabled inference workflow. | Approved inference service that generates and persists real outputs end to end. |
| Managed publish | The dashboard is publishable, but public model inference is intentionally absent. | User review of checkpoint and explicit use of the project interface’s Publish control. |

Until these gates close, NeuroInsight AI should remain an **academic research dashboard with honest unavailable-model states**, not a diagnostic or model-enabled service.
