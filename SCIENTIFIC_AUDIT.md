# Scientific Audit

## Executive conclusion

The supplied specification is technically ambitious but scientifically defensible only if it is implemented as two connected modes rather than as one universal model. Public four-class 2D image collections are commonly assembled from multiple sources and often lack patient identifiers, acquisition metadata, and a transparent licence chain. BraTS-style datasets, by contrast, are multimodal 3D glioma datasets with expert segmentation labels and NIfTI volumes. The implementation therefore separates **2D four-class classification** from **glioma-focused volumetric segmentation**.

## Findings and resolutions

| Audit item | Finding | Resolution |
|---|---|---|
| Product claim | A classifier or segmenter cannot be presented as a clinical diagnosis or replacement for an expert. | Use academic proof-of-concept language in the UI, reports, README, and deployment metadata. |
| Team roles | The role split is an academic description, not an execution boundary for an independent build. | Preserve the requested split in documentation and state that the complete integrated system was implemented independently. |
| Accuracy targets | The supplied material requires honest metrics but does not provide a valid target or an independent clinical benchmark. | Do not set or claim a target accuracy. Select models using validation criteria and report held-out metrics only after the pipeline is fixed. |
| Classification versus segmentation | The four-class JPEG/PNG collections do not provide a reliable common mask source, while BraTS focuses on glioma volumes and subregions. | Use Mode A for four-class classification and Mode B for BraTS-compatible glioma segmentation. |
| Grad-CAM | Grad-CAM is classifier attribution and coarse spatial evidence, not a boundary or segmentation result. | Label it as classifier attribution and show segmentation separately. |
| Confidence | Raw softmax is not a medically calibrated probability. | Label it “model confidence score”; compare temperature scaling and uncertainty proxies on validation data only. |
| 2D area | Physical area is not computable without pixel spacing. | Fall back to tumor pixels, image occupancy percentage, and relative area. |
| 3D volume | Volume needs compatible slices and voxel spacing in all dimensions. | Require compatible volumetric metadata; otherwise omit physical volume. |
| Segmentation scope | Traditional BraTS data are primarily glioma-focused and should not be generalized to meningioma or pituitary tumors. BraTS 2020 provides T1, post-contrast T1, T2, and FLAIR NIfTI volumes with expert subregion annotations [1]. | UI and model card explicitly state glioma-focused segmentation scope. |
| Dataset leakage | Slice-level random splitting can place slices from one patient in multiple partitions. | Use patient-level grouping where identifiers exist; otherwise document the limitation and avoid overstating generalization. |
| Augmentation | Anatomically implausible transforms can create invalid training examples. | Restrict augmentation to moderate intensity/geometric transforms; no vertical flips; evaluate horizontal flip policy. |
| Safety metrics | “Safe” or “definitely normal” would be clinically misleading. | Use low-confidence, incompatible-input, and manual-review language. |
| DICOM/NIfTI/PNG/JPEG | Formats have different metadata and loading requirements. | Validate each format separately; physical units are only reported when metadata is present and coherent. |
| Privacy | Public MRI can contain re-identification risk; TCIA notes that some data may permit face reconstruction and applies access policies [2] [3]. | Do not persist raw scans by default; use public/synthetic demo data only; retain minimal anonymized history. |
| LLM use | Sending raw scans or identity data to an external LLM is unnecessary and unsafe for the demo. | Pass only minimal structured context; provide offline fallback. |
| Calibration | A confidence score without validation is not a probability. | Report calibration only if it is actually evaluated; abstention threshold is selected on validation data. |

## Dataset evidence

The Kaggle four-class record states that its 7,200 images are assembled from multiple public sources, with 1,400 training and 400 testing images per class, and that the version-2 author removed duplicates and overlap between the supplied partitions [4]. However, the record does not itself establish patient-level identifiers, a complete upstream licence chain, or medical acquisition metadata. It is suitable as a candidate for audit and possibly as a reproducible research input only after licence/provenance review; it must not be treated as a clinically representative cohort.

The Figshare source contains 3,064 contrast-enhanced T1-weighted images from three tumor types and points to a README for detail [5]. It does not provide a no-tumor class. The TCIA Meningioma-SEG-CLASS collection has 96 patients with pre-operative T1, T1-CE, and T2-FLAIR studies, DICOM RTSTRUCT labels, and a CC BY 4.0 metadata/image access record, but access and face-reconstruction controls must be respected [2]. This is a viable research option for future meningioma segmentation, not a reason to claim multi-tumor segmentation in the first model.

BraTS-Africa has 146 patients, four mpMRI sequences, expert-annotated subregions, NIfTI distribution, and CC BY 4.0 access metadata [3]. It is an attractive external or supplementary glioma-focused segmentation evaluation set, but it is not interchangeable with a four-class 2D classification collection. BraTS 2020 and BraTS-Africa are therefore kept in the volumetric mode only.

## Scope accepted for implementation

The defensible initial scope is:

1. A four-class 2D classifier with explicit dataset provenance caveats, model confidence score, input-quality checks, uncertainty/abstention, and real Grad-CAM.
2. A binary whole-tumor glioma segmenter for compatible BraTS-style volumes, with physical measurements only when metadata supports them.
3. A common dashboard, report generator, history store, and safe contextual chatbot that disclose the active mode and limitations.
4. Optional 3D visualization only for a valid segmented volume, never for a standalone 2D image.

## References

[1]: https://www.med.upenn.edu/cbica/brats2020/data.html "BraTS 2020 official data page"
[2]: https://www.cancerimagingarchive.net/collection/meningioma-seg-class/ "TCIA Meningioma-SEG-CLASS"
[3]: https://www.cancerimagingarchive.net/collection/brats-africa/ "TCIA BraTS-Africa"
[4]: https://www.kaggle.com/datasets/masoudnickparvar/brain-tumor-mri-dataset "Kaggle Brain Tumor MRI Dataset"
[5]: https://figshare.com/articles/dataset/brain_tumor_dataset/1512427 "Figshare brain tumor dataset"
