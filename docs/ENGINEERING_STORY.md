# Engineering Story

NeuroInsight AI is intentionally designed as a research sandbox rather than a clinical-looking demo. Its strongest engineering work is in the boundaries: proving what the system can do, preventing it from pretending to do more, and keeping the evidence trail reproducible.

| Engineering problem | Implemented response | Evidence boundary |
|---|---|---|
| Dataset leakage and overstated metrics | Audited fixed image-level splits, duplicate controls, experiment ledger, calibration records, and explicit non-promotion of EXP-006 | EXP-005 remains image-level research evidence, not patient-level or clinical validation. |
| Deploying a real model safely | HTTPS model artifacts are checksum verified before ONNX loading; runtime label, preprocessing, temperature, and abstention contracts have regression tests | The contract is tested without committing model weights or redistributing source scans. |
| Explainability without false segmentation | Real Mode A Grad-CAM is shown as coarse classifier attribution; Mode B masks, volume, and 3D geometry fail closed | Attribution is not a tumour boundary or measurement. |
| Private derived artifacts | Raw uploads are discarded by default; saved Mode A artifacts use owner-scoped metadata and fresh signed downloads | Provider-side physical erasure is not verified and is documented as a manual/platform gate. |
| Public-demo abuse and browser threats | Bounded uploads, pixel checks, same-origin mutation protection, CSP, request IDs, and a process-local burst limiter | A distributed production limiter and signing secret remain infrastructure gates. |
| Accessible bilingual research UX | English/Hindi copy, skip links, labelled controls, text-visible warning states, and route-level accessibility checks | No language path removes the non-clinical warning. |
| Reproducibility under CI | Frozen dependency install, type/tests/build, raw-artifact hygiene, backend/ML tests, production audit, and an initial bundle budget | External inference remains an opt-in smoke check rather than a flaky ordinary-CI dependency. |

For architecture detail, see `docs/ARCHITECTURE.md`; for scientific boundaries, see `docs/CAPABILITY_MANIFEST.md` and `EXPERIMENTS.md`.
