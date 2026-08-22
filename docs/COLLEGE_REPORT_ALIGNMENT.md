# College Report Alignment: NeuroInsight AI

**Purpose.** This guide aligns the supplied synopsis and presentation with the deployed project as verified on **22 August 2026**. It is intended to make the final-year report stronger by separating what is **implemented and evidenced now** from what is a **future research objective**. The live application is an academic demonstration, not a diagnostic system.

> **Required statement for the report and presentation:** “This system is not a medical diagnosis and must not replace a qualified radiologist.”

## Recommended project title and abstract position

Use a title such as **“NeuroInsight AI: Experimental Brain MRI Image Classification and Explainable Analysis”** rather than “Detection & Diagnosis System.” The verified system provides an experimental four-class, two-dimensional image classifier; it does not diagnose a patient, identify tumor boundaries, estimate tumor size, or provide treatment advice.

The report should present the main contribution as **evidence-aware engineering**: audited dataset provenance, leakage-aware split checking, honest image-level evaluation, validation-only score calibration, real Grad-CAM, protected derived-artifact history, bilingual accessibility, and a deliberately disabled segmentation path until appropriate full-volume evidence exists. The authorised Mode A source is BDNeuro-MRI v7 under CC BY 4.0, not the Kaggle dataset named in the supplied college materials.[1]

## Synopsis and presentation audit

| College-material claim | Current project status | Report-ready wording |
|---|---|---|
| Four-class MRI classification | **Implemented and verified.** Mode A serves real ResNet50 EXP-005 ONNX inference for glioma, meningioma, pituitary tumor, and no-tumor image labels. | “An experimental 2D four-class image classifier was evaluated on an audited fixed public split.” |
| Claimed 95–99% accuracy target or comparison | **Do not use as project performance.** The held-out result is **80.99% accuracy**, macro-F1 **80.80%**, and weighted-F1 **81.10%**. | “Held-out fixed-split image-level accuracy was 80.99%; it is not patient-level, external, clinical, or diagnostic evidence.” |
| U-Net segmentation / tumor boundary | **Not implemented as a live validated feature.** Mode B correctly returns unavailable. | “Volumetric glioma segmentation is retained as future work and will require a verified full-volume model and held-out evaluation.” |
| Tumor size, volume, and severity | **Not available.** A classifier Grad-CAM is not a mask and cannot support measurement. | “Physical measurements are deliberately withheld unless a validated segmentation mask and compatible spatial metadata are available.” |
| 3D tumor visualisation | **Not available as a real output.** It depends on the unavailable segmentation model. | “3D visualisation is a future extension after validated full-volume segmentation.” |
| Grad-CAM explanation | **Implemented and verified.** It is generated from real Mode A inference. | “Grad-CAM shows coarse classifier attribution, not a tumor boundary or proof that the prediction is correct.” |
| Confidence and low-confidence review | **Implemented and verified.** Validation-only temperature scaling chose `T=0.689875`; the abstention threshold is `0.55`. | “The displayed value is a calibrated experimental model-confidence score, not a medical probability; expert review remains required.” |
| PDF report | **Implemented and verified.** The system creates a two-page research PDF from real results and Grad-CAM. | “The downloadable report is an academic research report, not a clinical report or clinical finding.” |
| English/Hindi chatbot | **Implemented with a safe offline FAQ.** It provides contextual educational replies and refuses diagnosis or treatment advice. | “The bilingual assistant is an offline, safety-first FAQ; it is not a live clinical LLM adviser.” |
| Scan history | **Implemented and verified.** With consent, only anonymous metadata, the derived PDF, and real Grad-CAM can be saved privately. | “Original MRI uploads are not stored by default; protected history contains consented derived artifacts only.” |
| FastAPI and React dashboard | **Implemented and deployed.** The public dashboard connects to a CORS-restricted ONNX Runtime FastAPI service. | “The system is a deployed academic web demonstration with health, readiness, validation, inference, report, and protected-history paths.” |

## What is strongest in the supplied materials

The supplied synopsis has three strong ideas worth preserving. First, its emphasis on **explainability and uncertainty** is appropriate and is now supported by real Grad-CAM and calibration evidence. Second, its separation of a core classifier from more ambitious segmentation/3D work is academically sound; the final report should move segmentation, sizing, and 3D into the **future-work** section rather than present them as complete. Third, its attention to a complete web workflow—upload validation, reporting, bilingual controls, and history—matches the deployed project well.

The presentation should replace broad claims that the system gives doctors a “second opinion,” “supports treatment,” or is “patient-ready.” These phrases imply clinical use. Describe it instead as a **strictly non-clinical educational and research prototype** with visible limitations.

## Evidence you can present during viva

| Demonstrable item | Evidence available in the project |
|---|---|
| Dataset choice and licence | `DATASET_AUDIT.md`, including the BDNeuro-MRI v7 provenance decision and fixed-split duplicate review.[1] |
| Reproducible experiment | `EXPERIMENTS.md`, `ml/classification/MODEL_CARD.md`, and the EXP-005 records. |
| Calibration and abstention | `docs/CALIBRATION_STATUS.md`, including validation-only temperature scaling and the abstention boundary. |
| Live deployment | Public dashboard plus a free Vercel ONNX inference service with exact-origin CORS restrictions. |
| Honest failure evidence | The test log records a lawful public glioma-labelled test image that the model predicted as meningioma; it is retained as an experimental error, not hidden.[2] |
| Testing and accessibility | **22** Vitest tests, **12** FastAPI tests, **4** ML/data tests, saved real-inference browser checks, English/Hindi flow checks, and WCAG 2 A/AA route audits.[2] |
| Privacy and history | User-approved end-to-end verification confirms that only derived metadata, PDF, and Grad-CAM were saved; the original upload was not stored and the temporary record was deleted.[2] |

## Suggested conclusion and future scope

The final report can conclude that NeuroInsight AI demonstrates a reproducible, privacy-conscious workflow for experimental 2D brain-MRI image classification. Its value is not a clinical claim or an inflated benchmark number. Its value is the transparent combination of data audit, real held-out evaluation, calibration, explainability, protected derived artifacts, bilingual accessibility, and explicit refusal to invent unsupported segmentation or measurement outputs.

Future work should be presented in this order: acquire a defensible glioma-focused full-volume dataset with masks and spatial metadata; train and evaluate a segmentation model on held-out volumes; establish segmentation metrics such as Dice and IoU; validate measurement calculations; then consider 3D visualisation and any future clinical validation under appropriate approvals. None of these future steps is active in the present deployed demonstration.

## References

[1] [Mendeley Data — BDNeuro-MRI v7, DOI: 10.17632/zwr4ntf94j.7](https://doi.org/10.17632/zwr4ntf94j.7)

[2] [NeuroInsight AI verification report](./TEST_REPORT.md)
