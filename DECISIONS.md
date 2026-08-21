# NeuroInsight AI Decisions

## D-001 — Two analysis modes instead of one universal model

**Decision:** Build a four-class 2D classification mode and a separate glioma-focused volumetric segmentation mode.  
**Rationale:** Public four-class image collections and BraTS-style volumetric segmentation datasets differ in modality, dimensions, labels, masks, and clinical scope. Combining them into one apparently universal pipeline would be scientifically invalid.  
**Status:** Accepted.

## D-002 — Confidence terminology

**Decision:** Display raw or uncalibrated softmax output as a **model confidence score**, not a medically valid probability.  
**Rationale:** Calibration must be evaluated on held-out validation data before probability language is justified.  
**Status:** Accepted.

## D-003 — Grad-CAM interpretation

**Decision:** Describe Grad-CAM as a coarse classifier-attribution map and never as a tumor boundary.  
**Rationale:** The segmentation mask, not the classifier attribution map, is the boundary-producing output.  
**Status:** Accepted.

## D-004 — Measurement gating

**Decision:** Require pixel spacing for physical 2D area and complete voxel spacing plus compatible slices for volume. Otherwise return pixel counts, occupancy percentage, or relative area only.  
**Rationale:** Unit claims without spatial metadata are unsupported.  
**Status:** Accepted.

## D-005 — Privacy by default

**Decision:** Do not request personal identifiers and do not persist raw scans by default. Store minimal anonymized demo history.  
**Rationale:** The application is an academic prototype and public neuroimaging data can still carry privacy risk.  
**Status:** Accepted.

## D-006 — Optional external LLM

**Decision:** The chatbot will work with an offline FAQ fallback and will receive only minimal structured analysis context when an external LLM is configured.  
**Rationale:** The core product must remain functional without a paid service or API key, and raw scans must not be sent to an LLM.  
**Status:** Accepted.

## D-007 — Dataset download gate

**Decision:** Do not download a raw dataset until its licence, provenance, format, and intended role are documented.  
**Rationale:** The supplied instructions explicitly prohibit silent acceptance of data terms and use of unclear sources.  
**Status:** Accepted.

## D-008 — Split dashboard and inference-service responsibilities

**Decision:** Use the managed React/tRPC application for the dashboard, history, storage references, and safe fallback interactions, while maintaining a separately runnable FastAPI service in `backend/` for Python imaging and model work.  
**Rationale:** The generated application scaffold provides secure storage and a durable user interface, whereas NIfTI/DICOM processing and trained PyTorch models require a Python-capable service with independently documented resource limits.  
**Status:** Accepted.

## D-009 — No simulated inference

**Decision:** Until verified training artifacts are available, the interface and API will return explicit model-unavailable states rather than prefilled predictions, masks, heatmaps, or metrics.  
**Rationale:** The project prohibits fabricated predictions, Grad-CAM, segmentation, metrics, and test outcomes.  
**Status:** Accepted.
