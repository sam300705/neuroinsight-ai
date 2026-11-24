"""Vercel entry point for the non-clinical NeuroInsight academic demonstration."""

import os

os.environ.setdefault(
    "CORS_ALLOWED_ORIGINS",
    "https://neuroaiapp-gtbxy6cw.manus.space,http://localhost:3000,http://127.0.0.1:3000",
)
os.environ.setdefault("PUBLIC_DASHBOARD_URL", "https://neuroaiapp-gtbxy6cw.manus.space")

from neuroinsight_api.app import app
