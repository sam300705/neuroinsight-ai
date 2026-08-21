# Classification Experiments

`train.py` runs a staged **head-only** transfer-learning smoke experiment using ResNet50 or EfficientNetB0. It freezes the selected ImageNet-pretrained backbone, trains only the final classification head with `AdamW`, and evaluates only on the deterministic validation partition from the deduplicated manifest. It never reads the original supplied test folder as a conventional held-out test set.

Example commands (run after the local audit has created the manifest):

```bash
python ml/classification/train.py \
  --manifest /home/ubuntu/neuroinsight-audits/mendeley_v1/deduplicated_manifest.csv \
  --dataset-root '/home/ubuntu/neuroinsight-datasets/mendeley_brain_tumor_v1/extracted/Epic and CSCR hospital Dataset' \
  --output /home/ubuntu/neuroinsight-experiments/resnet50-smoke \
  --architecture resnet50 --pretrained --epochs 1 --limit-per-class 80
```

These smoke experiments establish the reproducible pipeline and compare development validation behavior; they are not final models. A final selection requires a medically suitable, provenance-confirmed dataset with patient identifiers and an untouched patient-level test cohort.

