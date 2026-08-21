# Classification Smoke Experiments: Actual Development Evidence

The two experiments in this document were run on CPU from the audited Mendeley V1 archive. Both used ImageNet-pretrained backbones with frozen feature extractors and a newly trained four-class head. They were deliberately bounded to one epoch, 128×128 input, batch size 16, learning rate 0.001, fixed seed `20260821`, and 80 samples per class in both train and validation. Their purpose was to test the reproducible training pathway, not to claim a final research or clinical model.

| Experiment | Validation accuracy | Validation macro F1 | Notable per-class evidence | Runtime | Interpretation |
|---|---:|---:|---|---:|---|
| ResNet50 head-only | 0.5750 | 0.5828 | Glioma recall 0.750; meningioma F1 0.440; no-tumor F1 0.681; pituitary F1 0.630 | 6.03 s | Higher macro F1 in this narrowly scoped smoke experiment. |
| EfficientNetB0 head-only | 0.6094 | 0.5312 | Meningioma recall 0.025 and F1 0.048 despite stronger no-tumor/pituitary scores | 3.04 s | Higher accuracy but poorer class balance; no selection is justified. |

Neither row is a held-out test result. The original archive’s supplied split was rejected after 234 exact duplicate groups were identified across its partitions. The replacement split groups only exact image hashes and is not patient-level because the source lacks patient IDs. Consequently, these values must not be called clinical accuracy, diagnostic accuracy, medical probability calibration, or generalisation performance.

> **Decision:** no checkpoint is copied into the application and no inference endpoint is enabled from these smoke experiments. A model-selection experiment requires a provenance-confirmed dataset with patient identifiers, a locked patient-level split, broader training, calibration, threshold analysis, and a completely untouched patient-level test cohort.

The raw checkpoints and full JSON metrics remain outside the repository in `/home/ubuntu/neuroinsight-experiments`. They are not deployed artifacts.

