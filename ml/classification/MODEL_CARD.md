# Model Card: Mode A Experimental Classification Inference

## Status

**An optional local academic-demonstration classifier is available when explicitly configured.** The ResNet50 checkpoint and calibration JSON are deliberately external to Git and the default service image. Without `CLASSIFICATION_CHECKPOINT` and `CLASSIFICATION_CALIBRATION`, the API returns the honest unavailable-model response.

## Experimental evidence

EXP-005 trained an ImageNet-initialized ResNet50 frozen-backbone classifier with a four-class head on the CC BY 4.0 BDNeuro-MRI V7 public release. The official image-level split was locally audited: 5,941 images were readable; no exact cross-split duplicate groups were found; and 100 train/validation images from 101 perceptual-similarity review pairs were excluded conservatively. The final run used 4,070 training, 882 validation, and 889 held-out image-level test images.

| Metric | Actual result |
|---|---:|
| Validation accuracy / macro F1 | 0.8186 / 0.8238 |
| Held-out fixed-split test accuracy / macro F1 | 0.8099 / 0.8080 |
| Test F1: glioma / meningioma / no tumor / pituitary | 0.8373 / 0.7090 / 0.8133 / 0.8725 |
| Validation calibration temperature | 0.6899 |
| Validation ECE before / after temperature scaling | 0.0885 / 0.0251 |
| Validation abstention threshold | 0.55; 88.21% coverage and 85.35% accepted-sample accuracy |

## Scope and limitations

The data release retains no patient or case identifiers. These results are therefore **fixed-split image-level experimental metrics**, not patient-level, external, prospective, clinically validated, or diagnostic performance. The validation-only calibrated model confidence score is not a medical probability. Meningioma had the lowest reported class-level test F1 and warrants particular caution.

## Intended use and prohibited use

The classifier is intended only for academic research on compatible 2D PNG/JPEG images under the documented four-class label scope. It is not validated for diagnosis, triage, treatment planning, clinical workflow, population screening, or physical tumor measurement. A returned score is labelled as a **model confidence score**, never a medical probability. Grad-CAM is a coarse classifier attribution map and not a tumor boundary. Every response must retain the statement: **“This system is not a medical diagnosis and must not replace a qualified radiologist.”**
