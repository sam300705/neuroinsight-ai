# NeuroInsight AI Requirements

**Project owner:** Kumar Sambhav  
**Project type:** Academic proof-of-concept and clinical decision-support prototype  
**Implementation note:** The academic team role split is retained for project documentation, but the independent implementation and integration are performed as one engineering effort.

## 1. Product Positioning

NeuroInsight AI must be presented as an **academic research prototype** that demonstrates explainable brain MRI analysis. It must not be described as a certified diagnostic system, a replacement for a radiologist, a clinically validated product, or an approved medical device. Every analysis view and generated report must display an academic-use disclaimer and recommend review by a qualified expert.

## 2. Supported Analysis Modes

| Mode | Supported input | Required outputs | Scope limitation |
|---|---|---|---|
| 2D MRI classification | PNG/JPEG after strict validation | Four-class prediction: glioma, meningioma, pituitary tumor, or no tumor; model confidence score; Grad-CAM; quality and uncertainty state; report; chatbot context | The confidence is a model score, not a calibrated medical probability unless calibration is validated. |
| Volumetric segmentation | NIfTI and DICOM series only after compatibility checks | Whole-tumor segmentation, slice overlays, area, volume when valid spacing exists, optional 3D view, metrics when ground truth exists | Segmentation scope is glioma-focused when trained on BraTS-style data; it must not be generalized to meningioma or pituitary tumors. |

The interface may unify the modes, but it must visibly explain which input type and output are active. Unsupported or incompatible inputs must produce an actionable error state rather than a fabricated result.

## 3. Functional Requirements

The system shall provide versioned FastAPI endpoints for health/readiness, model information, classification, segmentation, combined analysis, report generation, safe contextual chat, and anonymized scan history. Upload handling must validate file size, extension, MIME type, file signature, corruption, and safe temporary-file handling. A scan identifier shall be an anonymized UUID; the demo shall not request names, Aadhaar numbers, phone numbers, hospital IDs, or equivalent identifiers.

The React dashboard shall include landing, analysis, results, history, methodology, model performance, limitations/responsible use, and about views. It shall support drag-and-drop upload, original scan display, prediction and confidence, uncertainty warnings, Grad-CAM opacity control, segmentation overlay, size measurement with units or explicit unit limitations, PDF download, chatbot, model version, processing time, bilingual English/Hindi text, and accessible responsive states for idle, validating, uploading, processing, success, low confidence, incompatible input, unsupported modality, unavailable server, partial analysis, and report failure.

The chatbot shall explain only the current structured analysis context and known limitations. It shall refuse diagnosis confirmation, treatment or surgery recommendations, modification of model results, requests for hidden instructions, and unsupported findings. An offline FAQ fallback is mandatory when no LLM credential is configured. Raw scans and identifying information must not be sent to an external language model.

## 4. Scientific Requirements

The classification pipeline shall use patient-level splitting whenever identifiers are available, apply augmentation only to training data, preserve an untouched test set, and record preprocessing and experiment configurations. At least ResNet50 and EfficientNetB0 or a justified alternative shall be compared using more than accuracy, including per-class precision/recall/F1, macro and weighted F1, confusion matrix, tumor-present sensitivity, false negatives, latency, model size, and calibration measures where applicable.

The segmentation pipeline shall use patient-level volume splits, validate orientation, spacing, and modalities, begin with binary whole-tumor segmentation, and report Dice, IoU, sensitivity, specificity, empty-mask behavior, per-patient metrics, and failure cases. Grad-CAM must be generated from the selected classifier and explicitly described as a coarse attribution map, never as a tumor boundary. Segmentation masks are the boundary-producing output.

The measurement service shall report pixel count, image occupancy percentage, and relative area when pixel spacing is absent. It may report physical area only when pixel spacing is available. It may report volume only when compatible multiple slices and voxel spacing, including slice depth, are available. Synthetic masks shall verify the formulas.

## 5. Documentation and Reproducibility

The repository shall contain setup, dataset, training, evaluation, API, frontend, deployment, model-card, data-card, security, privacy, and limitations documentation. It shall include `DECISIONS.md`, `EXPERIMENTS.md`, `PROJECT_STATUS.md`, and reproducible scripts. Raw datasets, restricted data, secrets, patient information, unlicensed model weights, and large generated artifacts must not be committed.

## 6. Verification and Definition of Done

Every visible control must have an implemented behavior and a test or documented manual verification. Automated tests shall cover machine-learning utilities, every backend endpoint, upload security, PDF generation, history CRUD, chatbot safety, frontend states, accessibility, and end-to-end user stories. The final project may claim a feature as complete only after the corresponding tests and visual verification pass. Metrics and deployment status must be reported only from actual runs.

## References

[1]: https://www.med.upenn.edu/cbica/brats2020/data.html "BraTS 2020 official data page"
[2]: https://www.cancerimagingarchive.net/collection/meningioma-seg-class/ "TCIA Meningioma-SEG-CLASS"
[3]: https://www.cancerimagingarchive.net/collection/brats-africa/ "TCIA BraTS-Africa"
[4]: https://www.kaggle.com/datasets/masoudnickparvar/brain-tumor-mri-dataset "Kaggle Brain Tumor MRI Dataset"
