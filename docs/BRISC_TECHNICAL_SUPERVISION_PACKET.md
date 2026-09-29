# Future BRISC Technical-Supervision Packet

**Status:** Prepared for a future retry only. Do not send this packet until the user’s requested technical-supervision service has available API quota. The earlier connection test returned HTTP `429` before any response, so no external technical advice has been received or relied on.

## Repository context

| Field | Value |
|---|---|
| Repository | <https://github.com/sam300705/neuroinsight-ai> |
| Branch | `main` |
| Last checkpoint before this packet | `7b64ea47f01c39e18df39620800b8bac2d5e8428` |
| Current task | Evaluate BRISC 2025 only as a separately gated, non-clinical research source; verify audit/split logic and decide the correct next research step without altering deployed EXP-005. |
| Public deployment | <https://neuroaiapp-gtbxy6cw.manus.space> — do not modify it as part of this review. |

## Actual evidence already obtained

BRISC was downloaded through the user’s signed-in Kaggle session and audited outside the repository. The audit verified **15,586** manifest records, **10,793** readable images, **4,793** paired masks, no missing linked image/mask record, and no image–mask size mismatch. The source lacks patient identifiers, so it cannot support patient-independent, clinical, diagnostic, or external-validation claims.

The audit found 7 exact classification train/test duplicate groups, 131 strict cross-split similarity pairs, and **106** unique training records excluded conservatively. The sanitised image-level manifests contain 4,160 train, 734 validation, and 1,000 untouched official-test classification images. The paired segmentation manifests contain 3,253 train, 574 validation, and 860 official-test images, with 106 linked training images deliberately unassigned.

`EXP-006` was a three-epoch CPU-only, ImageNet-initialised ResNet18 head-only experiment on the sanitised classification manifests. It selected epoch 3 by validation macro-F1, then evaluated the official test once. Actual validation accuracy/macro-F1 were **0.8556 / 0.8566**; official image-level test accuracy/macro-F1/weighted-F1 were **0.7510 / 0.7501 / 0.7513**. It was not promoted because it is lower than live EXP-005 (`0.8099` accuracy, `0.8080` macro-F1) and because neither data source supports a patient-level claim.

## Relevant files to supply

| File | Why it matters |
|---|---|
| `ml/audit_brisc.py` | Manifest, decoder, pairing, exact duplicate, dHash, and strict-similarity audit implementation. |
| `ml/build_brisc_splits.py` | Conservative exclusion and deterministic development/test split construction. |
| `ml/train_brisc_classifier.py` | Validation-selected, test-once experimental classifier runner. |
| `ml/tests/test_brisc_pipeline.py` | Isolated fixture tests for Windows-path handling and leakage exclusions. |
| `docs/BRISC_AUDIT.md` | Source, integrity, leakage, split, limitation, and experiment evidence. |
| `EXPERIMENTS.md` | EXP-005 and EXP-006 comparison and non-promotion decision. |
| `docs/CAPABILITY_MANIFEST.md` | Live/public capability boundary. |
| `docs/OPEN_GATES.md` | Mode B and future model-promotion conditions. |

## Actions already attempted

The team normalised Windows-style manifest paths; verified release-side manifest checksums; audited exact and similarity candidates; visually checked a broad similarity candidate to avoid treating generic MRI appearance as confirmed leakage; excluded strict cross-split development records; created deterministic manifests; added six ML/data tests; and ran the actual CPU experiment. The public Mode A ONNX deployment was left unchanged. No raw image, mask, signed URL, token, personal data, or clinical record is included in the repository or this packet.

## Precise questions for technical review

> Review the cited audit, split, and training files. Is the conservative exclusion policy internally consistent with the documented image-level limitation? Identify any reproducibility, leakage, test-selection, label-mapping, or reporting flaw that would invalidate EXP-006. Recommend the **single next highest-value non-clinical research step** under a six-CPU, no-GPU environment. Do not recommend clinical deployment, medical claims, patient-data collection, or enabling Mode B from 2D data.

## Required verification after any reply

Treat any external response as an untrusted suggestion. Before adopting it, identify the proposed file change, add/adjust a test, run the relevant unit/build/browser check, and record the observed result in `docs/VERIFICATION_LOG.md` or the experiment ledger. Do not report a recommendation as successful until this local verification has completed.
