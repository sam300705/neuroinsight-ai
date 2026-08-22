"""Vercel entry point for the non-clinical NeuroInsight academic demonstration."""

import os

os.environ.setdefault("ENABLE_EXPERIMENTAL_MODEL", "true")
os.environ.setdefault(
    "CLASSIFICATION_CHECKPOINT_URL",
    "https://files.manuscdn.com/user_upload_by_module/session_file/310519663899515611/rKWYdSgpHLvzPRNt.pt",
)
os.environ.setdefault(
    "CLASSIFICATION_CALIBRATION_URL",
    "https://files.manuscdn.com/user_upload_by_module/session_file/310519663899515611/nfSWpIWBrnhJWBLv.json",
)
os.environ.setdefault("CLASSIFICATION_CHECKPOINT_SHA256", "486c90e218e51b9feb667cfcc282ce2cb77b39d67fabc1b5e410228e55d468b1")
os.environ.setdefault("CLASSIFICATION_CALIBRATION_SHA256", "5a5527ad9f0c83c3f33d447262ed6216f18c3330ab14ec7eb00ed07ea8f4ff5d")
os.environ.setdefault(
    "CORS_ALLOWED_ORIGINS",
    "https://3000-ix9oexal674qfzqot8ods-4dc009ac.us3.manus.computer,http://localhost:3000,http://127.0.0.1:3000",
)

from neuroinsight_api.app import app

