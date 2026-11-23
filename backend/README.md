# FastAPI inference service

FastAPI validates uploads and owns the public API, signed reports, and contextual research assistant. The v3.2 inference worker runs TensorFlow/Keras and PyTorch in a separate Python environment and accepts requests on a private Unix socket. Mode A supports individual JPEG and PNG MRI slices and returns an experimental combined finding and 2D outline. Volumetric Mode B remains unavailable.

See [v3.2 provisioning and startup](../docs/V32_HANDOFF.md) for the verified artifacts, CPU worker installation, service commands, and private regression workflow. FastAPI starts without the worker and reports inference unavailable until the configured worker can answer after a successful forward pass. The lightweight Vercel entry point does not contain an inference worker.
