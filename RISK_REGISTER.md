# NeuroInsight AI Risk Register

| ID | Risk | Impact | Likelihood | Mitigation | Status / trigger |
|---|---|---:|---:|---|---|
| R1 | Composite 2D dataset has incomplete provenance, licence chain, or patient metadata | High | High | Audit upstream sources; defer download until terms are documented; report source limitations | Open until dataset preparation confirms provenance |
| R2 | Slice-level split leaks patient information | High | High | Group by patient ID; if unavailable, document the limitation and do not imply patient-level generalization | Open; checked by manifest audit |
| R3 | BraTS segmentation model is misinterpreted as universal tumor segmentation | High | Medium | Restrict UI/model card to compatible glioma-focused volumes | Mitigated by product scope |
| R4 | Raw softmax score is treated as a clinical probability | High | High | Use “model confidence score”; evaluate calibration separately; abstain below validated threshold | Mitigated in design; verify in UI/report tests |
| R5 | Grad-CAM is mistaken for a tumor boundary | High | Medium | Separate attribution and segmentation layers with persistent explanatory text | Mitigated in design |
| R6 | Physical area or volume is reported without spacing metadata | High | Medium | Measurement service enforces metadata prerequisites and reports pixels/occupancy otherwise | Verify with synthetic tests |
| R7 | DICOM or NIfTI orientation/modality handling is incorrect | High | Medium | Validate headers, sequence compatibility, orientation, spacing, and test known synthetic volumes | Open until loader tests pass |
| R8 | Model performance is weak or unstable | Medium | Medium | Compare architectures, use validation-only selection, report confidence intervals where practical, retain failure cases | Open until actual experiments |
| R9 | Pretrained weights cannot be downloaded or redistributed legally | High | Medium | Record source and licence; support training from scratch or user-provided weights without committing weights | Open until weight source is verified |
| R10 | Malicious or oversized upload causes resource exhaustion | High | Medium | Enforce byte limits, MIME/signature checks, temporary-file cleanup, decompression controls, and rate limiting | Backend security gate |
| R11 | Prompt injection or unsafe medical advice from chatbot | High | Medium | Minimal structured context, strict system policy, refusal patterns, offline FAQ fallback, adversarial tests | Backend/frontend safety gate |
| R12 | Raw scans or identifiers persist in demo history/logs | High | Medium | Store only derived anonymized records, never request identifiers, redact logs, delete temporary inputs | Verify with storage and log audit |
| R13 | Public deployment exposes credentials or permissive CORS | High | Medium | Environment variables, secret scanning, narrow origins, security checklist, production smoke test | Deployment gate |
| R14 | 3D rendering overloads mobile/ordinary hardware | Medium | Medium | Downsample visualization geometry only, preserve quantitative pipeline, loading/error states | Frontend performance gate |
| R15 | Backend model memory exceeds hosting limits | High | Medium | CPU-compatible inference, lazy optional model loading, quantization where safe, document resource requirements | Deployment decision gate |
| R16 | Dataset access requires login or legal acceptance | High | Medium | Stop at that specific action and ask the owner for authorization; do not accept on their behalf | User escalation condition |
| R17 | Deployment requires paid account or explicit authorization | Medium | Medium | Prepare deployable assets; request authorization only when necessary; do not purchase | User escalation condition |
| R18 | Documentation diverges from actual implementation | Medium | Medium | Update `PROJECT_STATUS.md` after each phase; run documentation consistency review before handover | Continuous |

## Security escalation rule

If a task requires accepting a data-use agreement, entering private credentials, purchasing hosting, or publishing an external service under the owner’s account, implementation will pause only at that boundary and request the specific authorization. Routine coding, local testing, public-source reading, and private repository preparation will continue independently.
