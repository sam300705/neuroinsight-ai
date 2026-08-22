# NeuroInsight AI Experiments

## Experiment ledger

| ID | Date | Mode | Dataset/version | Model/configuration | Split | Result | Status |
|---|---|---|---|---|---|---|---|
| EXP-000 | 2026-08-21 | Classification and segmentation | None; audit only | No model trained | None | No metric exists | Audit baseline |
| DATA-001 | 2026-08-21 | Classification | Mendeley Data V1, DOI 10.17632/zwr4ntf94j.1 | Integrity audit: SHA-256, decoder check, dHash candidate detection | Record-provided `Train`/`Test` folders inspected; no patient IDs | 12,064 decodable images; 1,026 exact-duplicate groups, including 234 groups spanning supplied partitions | Supplied test partition rejected for held-out evaluation |
| EXP-001 | 2026-08-21 | Classification | DATA-001 deduplicated manifest | ResNet50 ImageNet head-only transfer learning; 128 px, batch 16, AdamW 0.001, 1 epoch, seed 20260821 | Exact-image-hash grouped development split; 320 train / 320 validation, balanced 80 per class | Validation accuracy 0.5750; macro F1 0.5828; 6.03 s CPU | Exploratory development evidence only; not patient-level and no held-out test metric |
| EXP-002 | 2026-08-21 | Classification | DATA-001 deduplicated manifest | EfficientNetB0 ImageNet head-only transfer learning; 128 px, batch 16, AdamW 0.001, 1 epoch, seed 20260821 | Exact-image-hash grouped development split; 320 train / 320 validation, balanced 80 per class | Validation accuracy 0.6094; macro F1 0.5312; 3.04 s CPU | Exploratory development evidence only; not patient-level and no held-out test metric |
| DATA-002 | 2026-08-21 | Segmentation | Medical Segmentation Decathlon Task01 BrainTumour, release 2.0 | NIfTI decoder, SHA-256, shape, spacing, orientation, case/label linkage audit | 484 labelled training cases and 266 unlabelled test cases as declared in `dataset.json` | 1,234 readable NIfTI volumes across 750 cases; zero remaining incompatibilities after excluding 35 AppleDouble sidecars | Approved for bounded glioma-focused development; hidden test labels remain unused |
| EXP-003 | 2026-08-21 | Segmentation | DATA-002 Task01 labelled training cases | Tiny 2D U-Net; four MRI channels; binary whole-tumor target; 128 px, batch 4, AdamW 0.001, 10 epochs, seed 20260821 | 4 case-level train / 2 disjoint case-level validation; 32/16 selected tumor-positive axial slices | Final validation mean slice Dice 0.6759; pixel precision 0.8983; recall 0.7964; 126.55 s CPU | Bounded smoke evidence only; not full 3D, not hidden-test, not deployable |
| EXP-004 | 2026-08-21 | Segmentation inference artifact | EXP-003 checkpoint; Task01 `BRATS_450` | Full-volume slice-wise TinyUNet2D inference; threshold 0.5 | No model-selection update; case used only to verify artifact generation | Mask NIfTI and 240×240 overlay generated; 80,027 voxels; 80.027 mL using source 1 mm³ spacing | Exploratory case artifact only; not clinical measurement, not a deployed inference result |
| DATA-003 | 2026-08-22 | Classification | BDNeuro-MRI V7, DOI 10.17632/zwr4ntf94j.7, CC BY 4.0 | Decoder, SHA-256, 64-bit perceptual-DCT hash audit | Official 70/15/15 image-level folders; patient IDs absent | 5,941 readable images; 0 exact cross-split duplicate groups; 101 pHash review pairs; 100 train/validation images excluded conservatively | Approved for image-level academic demonstration only; not patient-independent evaluation |
| EXP-005 | 2026-08-22 | Classification | DATA-003 sanitized official manifest | ResNet50 ImageNet frozen-backbone, trained four-class head; 160 px, batch 24, AdamW 0.001, 3 epochs, seed 20260821 | 4,070 train / 882 validation / 889 held-out image-level test images | Validation accuracy 0.8186, macro F1 0.8238; test accuracy 0.8099, macro F1 0.8080, weighted F1 0.8110; 277.61 s CPU | Real experimental fixed-split evidence; not patient-level, external, calibrated, clinical, or diagnostic validation |

## Integrity rule

Every later experiment must record the dataset version, manifest checksum, patient-level split procedure, preprocessing configuration, seed, model architecture, optimizer, learning-rate schedule, stopping rule, checkpoint path, validation metrics, held-out test metrics, runtime, and reproduction command. A metric is not considered final until the test set has remained untouched during model and threshold selection.

## Current model-selection decision

Neither `EXP-001` nor `EXP-002` is selected for application inference. Both experiments were intentionally small, head-only, one-epoch smoke runs whose purpose was to validate the data-to-metrics pipeline and provide an honest architecture comparison. ResNet50 had the higher macro F1, whereas EfficientNetB0 had the higher accuracy but a severely low meningioma recall (0.025). Because their split is not patient-level and their configuration was not tuned, neither result supports a deployment decision.

`EXP-003` also remains non-deployable. It confirms that the NIfTI-to-mask pipeline, whole-tumor loss, case-level separation, and Dice evaluation are functional on a small selected-slice subset. Its final metric is not a full-volume result, not a comparison with a held-out labelled test cohort, and not evidence that the architecture should be surfaced in the application.

## Calibration status

No calibration method, calibration split, reliability analysis, expected calibration error, Brier score, or abstention threshold was calculated for the classification experiments. The segmentation smoke experiment likewise has no uncertainty calibration or full-volume threshold study. These omissions are recorded explicitly in `docs/CALIBRATION_STATUS.md`, and they are the reason neither checkpoint produces an application confidence score.

## EXP-005 interpretation

EXP-005 is the selected **Mode A academic demonstration candidate** because it uses a current four-class, single-source public record with a stated CC BY 4.0 licence, an official train/validation/test split, and a local duplicate audit. The held-out test accuracy was 0.8099 and macro F1 was 0.8080 on the released image-level test folder. Per-class test F1 was 0.8373 for glioma, 0.7090 for meningioma, 0.8133 for no tumor, and 0.8725 for pituitary.

> These numbers are limited to the sanitized released image-level split. The dataset has no retained patient identifiers, and no external cohort, reliability calibration, uncertainty threshold, or clinical validation was performed. They must not be presented as patient-level performance, clinical accuracy, diagnostic probability, or a radiologist substitute.
