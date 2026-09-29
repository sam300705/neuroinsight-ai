# Contributing to NeuroInsight AI

Contributions should improve the project’s reproducibility, privacy, accessibility, and academic transparency without adding unsupported clinical claims. Before starting, review `README.md`, `PROJECT_STATUS.md`, `docs/OPEN_GATES.md`, and the relevant model or dataset record.

## Development expectations

Use a focused branch and keep pull requests small enough to review. Do not commit raw MRI uploads, public dataset copies, test images, model checkpoints, private credentials, signed URLs, environment files, or generated caches. Any change to model, data, calibration, or reported metrics must include a reproducible command, provenance/update record, and appropriate tests.

Run the checks relevant to your change before opening a pull request. The baseline suite is `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build`, `cd backend && PYTHONPATH=. pytest -q tests`, and `PYTHONPATH=. pytest -q ml/tests`.

## Research and safety rules

Mode A results are fixed-split image-level experimental evidence only. Mode B is unavailable by design until a separate full-volume model meets the documented research gate. Do not describe Grad-CAM as segmentation, model confidence as medical probability, or the system as a diagnosis tool.

Report security vulnerabilities through the private procedure in `SECURITY.md`, not public issues or pull requests. By contributing, you agree to follow `CODE_OF_CONDUCT.md`.
