# External Prerequisites for Evidence-Gated Activation

NeuroInsight AI is intentionally retained as a **research dashboard with unavailable-model responses** until external evidence and user-controlled operational decisions are supplied. The following requirements cannot be completed safely inside the source repository alone.

| Open capability | Required external evidence or action | Why the repository cannot close it independently |
|---|---|---|
| Mode A final classification | A versioned source statement covering every image, a patient/case manifest, permitted use terms, a patient-disjoint split plan, and an untouched evaluation cohort. | Current public metadata confirms record-level licensing but does not establish a complete patient-level source chain. |
| Mode B final segmentation | A defined full-volume training protocol, held-out and preferably external evaluation, failure analysis, uncertainty policy, and clinical-scope review. | The available checkpoint is a bounded 2D smoke experiment, not a validated full-volume artifact. |
| Model confidence output | Validation-only calibration evidence and a fixed abstention threshold before locked testing. | Showing an uncalibrated score as a medical probability would be misleading. |
| Browser-side server validation | A separately deployed HTTPS FastAPI URL, a matching `VITE_INFERENCE_API_BASE_URL` at dashboard build time, and an exact `CORS_ALLOWED_ORIGINS` allowlist on the service. | The managed dashboard cannot safely assume an external hostname or change another service’s CORS policy. |
| Real history artifacts | An approved inference service that generates actual reports, overlays, masks, or geometry, followed by authenticated `saveResult` and `registerArtifact` calls. | The dashboard intentionally does not manufacture artifacts while no verified model is active. |
| Managed public publication | User review of a saved checkpoint and use of the project interface’s Publish control. | Publication is an explicit user authorization step and does not authorize model activation. |

> No one should interpret the current dashboard, its upload checks, its PDFs, or its visualization components as a certified medical device or clinical diagnostic system.

## What is already ready

The repository contains the safeguarded contracts for these future steps: server-side multipart validation, exact CORS allowlisting, unavailable-model responses, report rendering, object-storage registration, protected artifact lookup, scan-history isolation, and academic-use disclaimers. These components provide an auditable activation path once the required external evidence exists; they do not replace that evidence.

## Activation review checklist

Before any model artifact is attached to the service, record the following in version-controlled evidence documents:

1. Dataset version, upstream licence chain, patient/case count, and de-identification basis.
2. Split-generation code and a demonstrated patient-level overlap check.
3. Full training configuration, random seeds, preprocessing, and saved artefact hashes.
4. Validation calibration protocol, selected abstention rule, and a locked evaluation plan.
5. Reported held-out metrics with uncertainty intervals and a reviewed error/failure analysis.
6. Service deployment address, CORS allowlist, upload-retention decision, access controls, and rollback plan.
7. User approval to publish the dashboard and a separate approval to activate the specific model version.
