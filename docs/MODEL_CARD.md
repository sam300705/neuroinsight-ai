# Model Card — Mode A EXP-005

| Field | Recorded value |
|---|---|
| Purpose | Experimental four-class 2D brain-MRI image classification for academic research. |
| Model | ResNet50 head-only classifier, release identifier **EXP-005**. |
| Dataset | BDNeuro-MRI v7 audited fixed image-level split. |
| Held-out evidence | Accuracy `0.8099`; macro-F1 `0.8080`; weighted-F1 `0.8110`. |
| Calibration | Validation-only temperature `0.689875`; abstention threshold `0.55`. |
| Explainability | Final-layer Grad-CAM attribution only; not segmentation or a tumour boundary. |
| Unsupported claims | Patient-independent performance, external validation, clinical performance, medical probability, diagnosis, size, volume, and geometry. |
| Mode B | Unavailable; no full-volume model or release evidence is deployed. |

The detailed provenance, audit, and experiment record remains in [DATASET_AUDIT.md](../DATASET_AUDIT.md), [EXPERIMENTS.md](../EXPERIMENTS.md), and [CAPABILITY_MANIFEST.md](./CAPABILITY_MANIFEST.md).

