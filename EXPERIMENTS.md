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
| EXP-005 | 2026-08-22 | Classification | DATA-003 sanitized official manifest | ResNet50 ImageNet frozen-backbone, trained four-class head; 160 px, batch 24, AdamW 0.001, 3 epochs, seed 20260821 | 4,070 train / 882 validation / 889 held-out image-level test images | Validation accuracy 0.8186, macro F1 0.8238; test accuracy 0.8099, macro F1 0.8080, weighted F1 0.8110; 277.61 s CPU | Selected fixed-split Mode A experiment. Initial training metrics alone did not establish calibrated confidence; later validation-only calibration/abstention evidence is recorded separately as CAL-005. Not patient-level, external, clinical, or diagnostic validation. |
| CAL-005 | 2026-08-22 | Classification uncertainty/calibration | EXP-005 validation evidence | Temperature scaling fitted on validation evidence only; selective abstention threshold chosen from validation evidence | Validation-only calibration; held-out test remains model-evaluation evidence rather than a calibration fitting source | Temperature `0.689875`; ECE `0.0885 → 0.0251`; top-label Brier evidence `0.279 → 0.266`; abstention threshold `0.55`; validation coverage `0.8821`; accepted-sample accuracy `0.8535` | Accepted for the academic Mode A confidence/abstention display only. The score remains an experimental model-confidence score, not a medical probability; calibration does not establish shift robustness, external validity, conformal coverage, or clinical safety. |
| DATA-004 | 2026-08-23 | Classification and 2D segmentation | BRISC 2025, DOI 10.1038/s41597-026-06753-y, Kaggle CC BY 4.0 listing | Manifest checksum, decoder, paired-mask, SHA-256 duplicate, dHash and strict grayscale similarity audit | Official image-level 5,000 train / 1,000 test split; patient identifiers unavailable | 10,793 readable images; 4,793 masks; 7 exact classification cross-split groups and 131 strict similarity pairs; 106 training images excluded | Approved only for separate image-level research experiments; not patient-independent or deployable |
| EXP-006 | 2026-08-23 | Classification | DATA-004 sanitised BRISC manifests | ResNet18 ImageNet frozen-backbone, trained four-class head; 128 px, batch 32, AdamW 0.001, 3 epochs, seed 20260823 | 4,160 train / 734 validation / 1,000 untouched official image-level test images; test used only after validation selection | Best validation at epoch 3: accuracy 0.8556, macro F1 0.8566. Official test: accuracy 0.7510, macro F1 0.7501, weighted F1 0.7513; 70.68 s CPU | Separate research result only. It does not promote, replace, or alter deployed EXP-005 because its held-out image-level test result is lower and the source lacks patient identifiers. |

## Integrity rule

Every later experiment must record the dataset version, manifest checksum, patient/case split procedure when identifiers exist, preprocessing configuration, seed, model architecture, optimizer, learning-rate schedule, stopping rule, checkpoint/artifact identity, validation metrics, held-out test metrics, runtime, and reproduction command. A metric is not considered final until the test set has remained untouched during model and threshold selection. Calibration fitting and threshold selection must identify their own data scope rather than silently consuming held-out test evidence.

## Current model-selection decision

Neither `EXP-001` nor `EXP-002` is selected for application inference. Both experiments were intentionally small, head-only, one-epoch smoke runs whose purpose was to validate the data-to-metrics pipeline and provide an honest architecture comparison. ResNet50 had the higher macro F1, whereas EfficientNetB0 had the higher accuracy but a severely low meningioma recall (0.025). Because their split is not patient-level and their configuration was not tuned, neither result supports a deployment decision.

`EXP-003` also remains non-deployable. It confirms that the NIfTI-to-mask pipeline, whole-tumor loss, case-level separation, and Dice evaluation are functional on a small selected-slice subset. Its final metric is not a full-volume result, not a comparison with a held-out labelled test cohort, and not evidence that the architecture should be surfaced in the application.

`EXP-006` is also non-deployable. The BRISC audit found and excluded strict train/test similarity candidates, but the release still lacks patient identifiers. Its ResNet18 head-only test result (`0.7510` accuracy; `0.7501` macro F1) does not improve on the deployed EXP-005 image-level evidence, so no artifact was exported to the public ONNX service and no frontend capability changed.

`EXP-005` therefore remains the Mode A release experiment. `CAL-005` changes how its experimental confidence score is calibrated and when the UI abstains; it does **not** alter the underlying EXP-005 held-out accuracy/F1 evidence and does not upgrade the dataset from image-level to patient-level evidence.

## Calibration and selective-prediction status

The early experiments (`EXP-001` through the original `EXP-005` training/evaluation record) were not treated as calibrated merely because they produced softmax scores. The later `CAL-005` evidence explicitly records validation-only temperature scaling and the validation-derived `0.55` abstention threshold used by the current Mode A runtime.

The accepted CAL-005 values are:

- temperature: `0.689875`;
- ECE: `0.0885` before → `0.0251` after;
- top-label Brier evidence: `0.279` before → `0.266` after;
- validation coverage at threshold: `0.8821`;
- accepted-sample validation accuracy: `0.8535`.

These are bounded research-evaluation facts. They do not establish calibration under scanner/protocol/institutional shift, external validation, conformal prediction guarantees, or medical-probability semantics. The new reliability tooling can calculate ECE, top-label Brier evidence, Wilson intervals, and risk-coverage curves from a labeled evaluation bundle, but no additional metric is promoted into release evidence until its exact input bundle and protocol are recorded.

## EXP-005 interpretation

EXP-005 is the selected **Mode A academic demonstration candidate** because it uses a current four-class, single-source public record with a stated CC BY 4.0 licence, an official train/validation/test split, and a local duplicate audit. The held-out test accuracy was 0.8099 and macro F1 was 0.8080 on the released image-level test folder. Per-class test F1 was 0.8373 for glioma, 0.7090 for meningioma, 0.8133 for no tumor, and 0.8725 for pituitary.

> These numbers are limited to the sanitized released image-level split. The dataset has no retained patient identifiers and no accepted independent external cohort. CAL-005 adds validation-only score calibration and abstention evidence, but no patient-level, external, diagnostic, clinical, conformal-coverage, or radiologist-replacement claim is permitted.
