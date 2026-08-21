# NeuroInsight AI Project Status

**Last updated:** 2026-08-21  
**Current phase:** Phase 2 — project architecture and scaffold integration  
**Owner:** Kumar Sambhav  
**Implementation status:** Audit complete; managed web application initialized and architecture contracts established. Feature implementation is in progress.

## Completed tasks

The supplied instruction file was read completely. The project requirements were converted into `REQUIREMENTS.md`. Scientific contradictions and unsafe claims were analyzed in `SCIENTIFIC_AUDIT.md`. Candidate public datasets were reviewed from authoritative source pages and documented in `DATASET_AUDIT.md`. The staged build and verification gates were written to `IMPLEMENTATION_PLAN.md`, and the initial technical, privacy, licensing, and deployment risks were recorded in `RISK_REGISTER.md`.

The audit established two supported modes: four-class 2D classification and glioma-focused volumetric segmentation. It also established that raw softmax values will be labelled model confidence scores, Grad-CAM will not be presented as a tumor boundary, and physical measurements will be omitted when required spatial metadata is unavailable.

## Actual verification performed

The supplied upload directory contained one file, `pasted_content.txt`; no separate synopsis or revision guide was present. Public source pages were retrieved for the Kaggle four-class candidate, Figshare three-class source, Zenodo composite record, Mendeley four-class record, official BraTS 2020, BraTS-Africa, and TCIA Meningioma-SEG-CLASS. No raw dataset has been downloaded. No model has been trained and no model performance metric has been claimed.

The managed React dashboard now provides responsive landing, analysis, results, history, methodology, performance, limitations, and about pages. Desktop and mobile screenshots were checked for the main dashboard, upload mode selection, results empty state, history, methodology, performance, limitations, and about views. The FastAPI skeleton completed 10 unit/integration tests covering health/readiness honesty, PNG validation, corrupted/wrong-extension rejection, valid NIfTI validation, measurement safeguards, treatment refusal, and English/Hindi prompt-injection refusal. The TypeScript type check, existing Vitest suite, and production build passed.

The Mendeley V1 classification archive was downloaded to an untracked local workspace and audited. All 12,064 images decoded successfully, but 1,026 exact-duplicate groups were found; 234 groups crossed the record-supplied train/test folders. That supplied partition is rejected for held-out evaluation. A hash-grouped non-patient-level development manifest was created solely to test the reproducible training pipeline. Two head-only, one-epoch CPU smoke experiments were run: ResNet50 achieved validation macro F1 0.5828 and EfficientNetB0 achieved 0.5312. Neither is a held-out or patient-level result, so neither weight file is selected or deployed.

The openly accessible Medical Segmentation Decathlon Task01 BrainTumour archive was also downloaded and audited in the untracked data workspace. It contains 1,234 readable NIfTI volumes across 750 cases: 484 labelled training cases and 266 unlabelled test cases, with four MRI channels and zero genuine volume incompatibilities. A bounded TinyUNet2D whole-tumor smoke experiment used four train and two disjoint validation cases, reaching final mean validation slice Dice 0.6759. This is selected-slice development evidence only; no segmentation checkpoint is exposed in the application.

The managed database now has `scan_records` and `scan_artifacts` tables. Protected procedures store anonymous scan-result metadata, durable S3 references for derived report/overlay/mask/3D artifacts, owner-only retrieval, individual deletion, and a literal-confirmed delete-all operation. The FastAPI service now generates a PDF whose unavailable fields remain unavailable and whose research-use warning is prominent. The report route passed a PDF-header integration test; all FastAPI tests currently pass.

The final verification run passed 11 FastAPI tests, 4 ML/data tests, 5 Vitest tests, `pnpm check`, and the production build. A real Grad-CAM overlay was generated from the exploratory ResNet50 smoke checkpoint and visually checked, but it is retained only as a development artifact because the underlying classification source has unresolved provenance limitations. Deployment handover guidance is recorded in `docs/DEPLOYMENT.md`; the managed dashboard remains deliberately model-unavailable until a separate approval gate is met.

## Current blockers

No technical blocker exists for scaffolding and local implementation. Dataset download remains gated by verification of the complete licence/provenance chain for the selected classification source and by any access agreement required for BraTS or TCIA data. Deployment authorization and credentials have not been requested because local implementation and testing can proceed first.

## Files changed

- `REQUIREMENTS.md`
- `SCIENTIFIC_AUDIT.md`
- `DATASET_AUDIT.md`
- `IMPLEMENTATION_PLAN.md`
- `RISK_REGISTER.md`
- `PROJECT_STATUS.md`

## Next actions

Implement reproducible data-audit utilities, download instructions, integrity checks, duplicate detection, and manifests before any dataset download. Then install and evaluate verified model artifacts only after the selected source’s licence and provenance are confirmed.

## Known limitations

The initial audit relies on public source records and not on downloaded file-level manifests. Several candidate 2D datasets lack patient-level metadata and transparent upstream composition. Therefore, no generalization or clinical performance claim is currently possible.
