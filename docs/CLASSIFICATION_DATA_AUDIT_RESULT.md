# Mendeley V1 Classification Dataset: Actual Integrity-Audit Result

**Date:** 2026-08-21. **Dataset:** *Brain Tumor MRI Dataset (Glioma, Meningioma, Pituitary, No Tumor)*, version 1, DOI `10.17632/zwr4ntf94j.1`. The public record presents the dataset as CC BY 4.0, containing 12,064 pre-processed T1-weighted contrast-enhanced 2D images in four class folders.[1] The downloaded 239 MB public archive and all extracted images are kept outside the repository at `/home/ubuntu/neuroinsight-datasets`; the repository contains only the audit code and this compact evidence record.

## Checks performed

The audit decoded every PNG/JPEG with Pillow, calculated SHA-256 hashes, extracted dimensions and image modes, and generated a conservative perceptual-hash candidate list. It inspected the record-supplied `Train` and `Test` folders rather than assuming that they form a valid held-out partition. Patient identifiers were absent from the archive, so a patient-level split could not be created.

| Check | Actual result | Consequence |
|---|---:|---|
| Decodable supported images | 12,064 | No corrupted/unsupported image was found. |
| Exact duplicate groups | 1,026 | The archive contains repeated identical image bytes. |
| Exact duplicate image occurrences | 2,198 | A standard random image-level split would amplify leakage risk. |
| Exact-duplicate groups across supplied `Train`/`Test` | 234 | The supplied `Test` folder is invalid as a conventional held-out evaluation set. |
| Exact-duplicate occurrences across supplied partitions | 528 | No metric from the supplied split may be reported as held-out performance. |
| Perceptual-hash candidate pairs | 21,241 | These are candidates for further visual/dataset-level review, not confirmed duplicates. |

The observed class counts were 3,018/2,183/2,504/1,945 for train glioma/meningioma/pituitary/no-tumor and 755/546/626/487 for test glioma/meningioma/pituitary/no-tumor. The folder name for pituitary differs from the descriptive count order but the manifest retains the actual on-disk label. The zero corruption count does **not** validate clinical labels, source provenance, acquisition homogeneity, or medical appropriateness.

## Decision

> The supplied record partition is **rejected for held-out test reporting** because exact duplicates appear across `Train` and `Test`.

For pipeline validation only, a deterministic development split grouped by exact SHA-256 hash was created. It prevents the same exact image bytes from appearing in more than one development partition. It cannot prevent slice/patient leakage or resolve unknown source composition because no patient identity mapping exists. Any result from that fallback is labelled **non-patient-level development evidence** and never used in the dashboard as a deployed model score.

## Reproduction

```bash
python scripts/audit_classification_dataset.py \
  --input '/home/ubuntu/neuroinsight-datasets/mendeley_brain_tumor_v1/extracted/Epic and CSCR hospital Dataset' \
  --output /home/ubuntu/neuroinsight-audits/mendeley_v1

python scripts/summarize_data_audit.py \
  --input /home/ubuntu/neuroinsight-audits/mendeley_v1/classification_audit.json \
  --output /home/ubuntu/neuroinsight-audits/mendeley_v1/summary.json

python scripts/prepare_deduplicated_classification.py \
  --manifest /home/ubuntu/neuroinsight-audits/mendeley_v1/classification_manifest.csv \
  --output /home/ubuntu/neuroinsight-audits/mendeley_v1/deduplicated_manifest.csv
```

## References

[1]: https://data.mendeley.com/datasets/zwr4ntf94j/1 "Mendeley Data: Brain Tumor MRI Dataset (Glioma, Meningioma, Pituitary, No Tumor), Version 1"

