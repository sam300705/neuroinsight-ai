# Python Reproducibility and Supply-Chain Boundary

`backend/pyproject.toml` is the sole authoritative declaration of runtime and test dependencies. `backend/uv.lock` is the resolved, committed lock for the supported **Python 3.12** target. `requirements.lock` and `requirements-test.lock` are generated exports for constrained runtime and test installation; `requirements.txt` is a compatibility pointer only and must not carry independent version ranges.

## Clean-checkout workflow

```bash
uv lock --directory backend --check
uv sync --directory backend --locked --extra test
cd backend
uv run --locked --extra test coverage run -m pytest -q tests
uv run --locked --extra test coverage json -o coverage.json
uv run --locked --extra test python scripts/check_critical_coverage.py
uv run --locked --extra test pip-audit -r requirements.lock --strict
uv run --locked --extra test cyclonedx-py requirements requirements.lock --output-file /tmp/neuroinsight-backend-sbom.json
```

The Docker image now uses `python:3.12-slim`, installs the generated runtime constraints, then installs the local package without dependency resolution. CI also uses Python 3.12 and builds/smoke-tests the container with `USE_ONNX_CLASSIFIER=false` and `ENABLE_EXPERIMENTAL_MODEL=false`; no model credentials are needed for that check.

Coverage thresholds apply only to selected high-risk code, not as a claim of complete behavioral coverage. The current thresholds are receipt integrity **85%**, research assistant **90%**, artifact loader **70%**, upload validation **60%**, FastAPI route logic **80%**, and TypeScript critical-module coverage of **80% lines**, **95% functions**, and **50% branches**. Dependency audit results describe only the locked packages checked at that time; they do not prove that future vulnerabilities cannot exist.
