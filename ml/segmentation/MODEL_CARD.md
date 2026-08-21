# Model Card: Segmentation Inference Status

## Status

**No deployable segmentation model is available.** The repository supplies a reproducible, bounded case-level NIfTI smoke experiment but contains no user-facing inference checkpoint.

## Data and target

The exploratory pipeline uses Medical Segmentation Decathlon Task01 BrainTumour’s four MRI channels. It combines edema, non-enhancing tumor, and enhancing tumor into a binary whole-tumor mask. It is therefore **glioma-focused** and does not establish segmentation performance for meningioma, pituitary tumors, metastases, or normal MRI.

## Exploratory result

On four training and two case-disjoint validation volumes, with selected positive 2D slices only, a TinyUNet2D reached mean validation slice Dice 0.6759 after ten epochs. This is not a full-volume, hidden-test, or clinical metric and the checkpoint is not approved for inference.

