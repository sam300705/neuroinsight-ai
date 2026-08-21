# Segmentation Experiments

`train.py` is a deliberately bounded **2D whole-tumor** smoke experiment for Medical Segmentation Decathlon Task01. It reads its NIfTI case pairs from `dataset.json`, selects only positive axial slices from a deterministic training and validation case subset, takes all four stated MRI modalities as input, and combines the task labels into a binary whole-tumor target.

The code demonstrates case-level splitting and Dice-based evaluation. It does **not** replace a full 3D U-Net/nnU-Net training and validation program, and its checkpoint is never used by the deployed dashboard.

