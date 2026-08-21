# FastAPI Inference Service

This directory will contain the separately runnable FastAPI service for secure image/volume validation, model inference, Grad-CAM, segmentation, measurement, PDF report construction, and safe contextual-chat support. It remains separate from the managed application server because Python scientific packages, NIfTI/DICOM utilities, and model artifacts have a different deployment profile from the dashboard.

The service will not ship model weights until the selected model has a documented source, licence, training configuration, and evaluated metrics. Until then, its API will expose explicit `model_unavailable` states rather than simulated predictions.

