# NeuroInsight AI v3.2 handoff provisioning

Keep the three supplied ZIP parts and their extracted contents in private storage outside the checkout. The provisioner accepts filenames with any prefix, including upload copy markers, and reconstructs the three files in suffix order. It checks the expected 1,120,009,578-byte length and SHA-256 before parsing the ZIP. It validates member paths and types and checks CRCs while extracting to a private staging directory. The destination appears after successful extraction. Extraction requires free space for both the reconstructed ZIP and its expanded contents.

Run from the checkout root with Python 3.12. Use the actual private path to each part and a fresh destination name.

```bash
umask 077
mkdir -p /workspace/private-neuroinsight
python3 scripts/provision_v32_handoff.py \
  --output /workspace/private-neuroinsight/handoff-v32 \
  "/path/to/NeuroInsight_AI_Handoff.zip.part1" \
  "/path/to/NeuroInsight_AI_Handoff.zip.part2" \
  "/path/to/NeuroInsight_AI_Handoff.zip.part3"

python3 -m unittest discover -s scripts -p test_provision_v32_handoff.py -v
```

## v3.2 runtime

The combined Drive ZIP has the same exact length and digest as the reconstructed three-part ZIP. It can be supplied directly to the provisioner.

```bash
python3 scripts/provision_v32_handoff.py \
  --output /workspace/private-neuroinsight/handoff-v32 /workspace/private-neuroinsight/handoff.zip
```

Keep the supplied source, weights, CSV, and images read-only.

The runtime expects the extracted `NeuroInsight_AI_Handoff/backend/models` directory and its sibling `neuroinsight_pipeline.py`. The checked-in artifact manifest fingerprints the supplied source, the three classifier weights, classifier configuration, all three segmentation configuration files, and each of the five unpacked checkpoint trees. Set the model directory using `--models`. The worker loads the three deployed EfficientNetV2-S folds and five U-Net/ResNet34 folds once, restricts PyTorch loading to weights, checks state keys, and exposes its socket after a successful real forward pass.

Run these commands from the repository root on Linux with Python 3.12, uv, Node 22, and pnpm 10.4.1. Set `NEUROINSIGHT_PRIVATE` to a private directory outside the checkout and `NEUROINSIGHT_HANDOFF` to the extracted handoff root. Use the same values in each service terminal.

```bash
export NEUROINSIGHT_PRIVATE=/workspace/private-neuroinsight
export NEUROINSIGHT_HANDOFF="$NEUROINSIGHT_PRIVATE/handoff-v32/NeuroInsight_AI_Handoff"
umask 077
uv sync --directory backend --locked --extra test
uv venv --python 3.12 "$NEUROINSIGHT_PRIVATE/runtime"
uv pip install --python "$NEUROINSIGHT_PRIVATE/runtime/bin/python" \
  --index https://download.pytorch.org/whl/cpu \
  'torch==2.10.0+cpu' 'torchvision==0.25.0+cpu'
uv pip install --python "$NEUROINSIGHT_PRIVATE/runtime/bin/python" \
  -r backend/requirements-v32-worker.txt
pnpm install --frozen-lockfile
```

Start the worker, API and dashboard in three separate terminals. Use a fresh socket path after an unclean worker stop, or remove the stale socket only after confirming the previous worker has stopped.

```bash
# Worker, in backend/
cd backend
CUDA_VISIBLE_DEVICES=-1 TF_NUM_INTRAOP_THREADS=3 TF_NUM_INTEROP_THREADS=1 OMP_NUM_THREADS=3 \
  "$NEUROINSIGHT_PRIVATE/runtime/bin/python" -m neuroinsight_api.v32_worker \
  --models "$NEUROINSIGHT_HANDOFF/backend/models" --socket "$NEUROINSIGHT_PRIVATE/inference.sock"
```

```bash
# FastAPI, in backend/. The generated key is for this local session only.
cd backend
export ANALYSIS_RECEIPT_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
NEUROINSIGHT_V32_SOCKET="$NEUROINSIGHT_PRIVATE/inference.sock" \
  .venv/bin/uvicorn neuroinsight_api.app:app --host 127.0.0.1 --port 8000
```

```bash
# Dashboard, in the repository root
PORT=3000 VITE_INFERENCE_API_BASE_URL=http://127.0.0.1:8000 pnpm dev
```

Check `/health`, `/ready`, and `/api/v1/model-info` on the API. `/ready` also checks the deployment's required shared controls. For a private browser smoke test, upload a separately authorized grayscale PNG or JPEG outside the locked evaluation split through the normal Analyse screen. A generated grayscale test image can validate this transport and rendering path without disclosing MRI data. If testing Mode A with a mask, check the outline toggle, original-image dimensions, separate classifier attention, and signed PDF. Keep handoff evaluation images private.

To automate the private browser and signed PDF check, set `E2E_INPUT_IMAGE` to a separately authorized local fixture. Use `E2E_REQUIRE_OUTLINE=true` only for a separate private fixture expected to have an outline.

```bash
E2E_BASE_URL=http://127.0.0.1:3000 INFERENCE_API_BASE_URL=http://127.0.0.1:8000 \
  E2E_INPUT_IMAGE="$NEUROINSIGHT_PRIVATE/synthetic-browser-slice.png" \
  PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/verify-v32-browser.mjs
```

Run the exhaustive fixture check and application checks from the repository root:

```bash
(cd backend && PYTHONPATH=. CUDA_VISIBLE_DEVICES=-1 TF_NUM_INTRAOP_THREADS=3 \
  TF_NUM_INTEROP_THREADS=1 OMP_NUM_THREADS=3 "$NEUROINSIGHT_PRIVATE/runtime/bin/python" \
  scripts/check_v32_regression.py "$NEUROINSIGHT_HANDOFF")
(cd backend && uv run --locked --extra test pytest -q tests ../ml/tests)
pnpm check
pnpm test:coverage
pnpm build
pnpm check:bundle
pnpm release:verify
```

Fixture comparison uses exact classification/combined labels and detection, review, and uncertainty flags. The absolute tolerances are 0.01 for confidence, presence and segmentation uncertainty, 0.5 percentage points of estimated brain area, and the larger of 50 pixels or 3% for mask area. The checker also validates mask size, binary pixels, bounds, and area in source coordinates. The CSV lacks reference masks, so this does not establish pixel-for-pixel parity.

The source overlay and classifier attention are transient. The signed report can embed a digest-bound binary mask with no source pixels. Saved history retains the finding summary in the existing measurement JSON and preserves historical EXP-005 records without a schema migration.

## Owner deployment and rollback

Use a long-running Linux API and worker on the same host or mounted private Unix-socket volume. Configure receipt signing, existing shared abuse/replay controls, and the authorized dashboard HTTPS origin on that API. Set the dashboard build's `VITE_INFERENCE_API_BASE_URL` to the new API HTTPS origin. The lightweight serverless entry point keeps validation, reporting and chat but cannot run this worker. Promote only after private environment and owner acceptance. No production settings are changed by these steps.

To roll back a deployed application, restore the previous approved dashboard and API build and their previous configuration together. Stop the v3.2 worker when it has no callers. Keep the database and saved artifacts. No database migration is required for the v3.2 summary.
