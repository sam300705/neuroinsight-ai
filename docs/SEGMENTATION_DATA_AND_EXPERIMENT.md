# Glioma-Focused Volumetric Segmentation: Data and Smoke-Experiment Result

The volumetric development source is Medical Segmentation Decathlon Task01 BrainTumour. The official AWS Open Data Registry describes the Medical Segmentation Decathlon as an open NIfTI segmentation resource under CC BY-SA 4.0, available in a public S3 bucket without an AWS account.[1] The downloaded Task01 archive’s `dataset.json` identifies a BRATS release, four MRI modalities (FLAIR, T1w, T1gd, T2w), labels for edema, non-enhancing tumor, and enhancing tumor, and 484 training plus 266 test cases.

## Actual local audit

The 7.1 GB archive was retained outside the repository. Its NIfTI auditor decodes headers, captures spacing/orientation and checksums, links each image to its matching training label by case ID, and ignores `._` AppleDouble archive sidecars rather than treating them as medical-image corruption.

| Audit item | Actual result | Interpretation |
|---|---:|---|
| Readable NIfTI volumes | 1,234 | 484 labelled image volumes + 484 training labels + 266 unlabelled test volumes. |
| Unique cases | 750 | Matches the declared 484 training + 266 test case population. |
| Incompatible medical-image volumes | 0 | All genuine NIfTI volumes passed decoder/header checks. |
| AppleDouble sidecars excluded | 35 | Archive metadata, not MRI volumes; exclusion is unit tested. |
| Available MRI inputs | 4 channels | FLAIR, T1w, T1gd, and T2w, as declared by `dataset.json`. |
| Available labelled cases | 484 | Suitable for a case-level development split. |

## Actual segmentation smoke experiment

The experiment used four randomly seeded, **case-disjoint** training volumes and two case-disjoint validation volumes. For bounded CPU execution, it selected eight positive axial slices per case, resized them to 128×128, and trained a small 2D U-Net for ten epochs. The target was binary **whole tumor**: all non-zero source labels were combined, so the output is not a subregion classifier.

| Measure | Actual value |
|---|---:|
| Training slices | 32 from 4 cases |
| Validation slices | 16 from 2 disjoint cases |
| Final validation mean slice Dice | 0.6759 |
| Pixel precision at threshold 0.5 | 0.8983 |
| Pixel recall at threshold 0.5 | 0.7964 |
| Runtime | 126.55 seconds on CPU |

> These values are **not** full-volume Dice, hidden-test performance, clinical validation, or a production model-selection result. The output checkpoint is not packaged into the service or dashboard.

The result demonstrates a functioning, reproducible case-level NIfTI segmentation path. A candidate for user-facing research inference would still require broader training, full 3D architecture/validation, a selected stopping rule, calibration of uncertainty behavior, complete full-volume evaluation, and an untouched labelled external cohort.

## Exploratory artifact-generation check

The saved `TinyUNet2D` checkpoint was then run slice-wise on Task01 case `BRATS_450` to verify artifact generation. It created an actual NIfTI whole-tumor mask and a 240×240 red-overlay PNG. The mask contained **80,027 voxels**. Because this source volume records 1 mm³ spacing, the utility emitted a voxel-derived value of **80.027 mL**. The image was visually checked and remains an exploratory artifact; it is not displayed by the deployed dashboard and must not be treated as a clinical volume estimate.

## References

[1]: https://registry.opendata.aws/msd/ "Medical Segmentation Decathlon — Registry of Open Data on AWS"
[2]: https://www.nature.com/articles/s41467-022-30695-9 "The Medical Segmentation Decathlon"
