"""Vercel entry point for the non-clinical NeuroInsight academic demonstration."""

import os

os.environ.setdefault("ENABLE_EXPERIMENTAL_MODEL", "true")
os.environ.setdefault("USE_ONNX_CLASSIFIER", "true")
os.environ.setdefault("CLASSIFICATION_ONNX_URL", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663899515611/wAUbhOfRwdKzxfHf.onnx")
os.environ.setdefault("CLASSIFICATION_ONNX_SHA256", "d0dca82950269aaf64ae07a1393776bbc3486fa2a609a682ee1883019341b479")
os.environ.setdefault("CLASSIFICATION_ONNX_METADATA_URL", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663899515611/IikqIvqBXLCGVUZY.json")
os.environ.setdefault("CLASSIFICATION_ONNX_METADATA_SHA256", "973cf4ec4a4c4c9b2030d5247c78f6c74ee32d5b91d5e0103f324d41bb1487bf")
os.environ.setdefault(
    "CLASSIFICATION_CALIBRATION_URL",
    "https://files.manuscdn.com/user_upload_by_module/session_file/310519663899515611/nfSWpIWBrnhJWBLv.json",
)
os.environ.setdefault("CLASSIFICATION_CALIBRATION_SHA256", "5a5527ad9f0c83c3f33d447262ed6216f18c3330ab14ec7eb00ed07ea8f4ff5d")
os.environ.setdefault(
    "CORS_ALLOWED_ORIGINS",
    "https://neuroaiapp-gtbxy6cw.manus.space,http://localhost:3000,http://127.0.0.1:3000",
)

from neuroinsight_api.app import app
