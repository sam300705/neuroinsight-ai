# Model Card: Classification Inference Status

## Status

**No deployable four-class classifier is available.** The repository contains reproducible code for controlled transfer-learning experiments, but no model checkpoint is packaged with the service or dashboard.

## Exploratory evidence

Two CPU head-only smoke experiments were executed on an audited public dataset. ResNet50 achieved development validation macro F1 of 0.5828 and EfficientNetB0 achieved 0.5312. These are not patient-level or held-out test results, and neither checkpoint is selected for inference.

## Intended use and prohibited use

The planned future classifier is intended only for academic research on compatible 2D PNG/JPEG images under the documented four-class label scope. It is not validated for diagnosis, triage, treatment planning, clinical workflow, population screening, or physical tumor measurement. A score from a future calibrated model must still be labelled as a **model confidence score**, not a medical probability.

