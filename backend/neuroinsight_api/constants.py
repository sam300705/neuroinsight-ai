ACADEMIC_DISCLAIMER = (
    "Academic and research use only. This system is not a medical diagnosis and must not replace "
    "a qualified radiologist."
)

GRAD_CAM_DISCLAIMER = (
    "Grad-CAM shows regions that influenced the classifier. It is a coarse classifier-attribution "
    "map, not an exact tumor boundary and not proof of medically correct reasoning."
)

GLIOMA_SCOPE_DISCLAIMER = (
    "Segmentation is limited to compatible glioma-focused volumetric inputs. It is not validated "
    "for meningioma, pituitary tumors, or standalone 2D images."
)

MODEL_UNAVAILABLE_MESSAGE = (
    "No verified model artifact is configured. The service will not fabricate a prediction, "
    "segmentation mask, Grad-CAM image, or confidence score."
)

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
# Multipart framing adds a small amount of overhead beyond the uploaded file.
MAX_MULTIPART_REQUEST_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024
# Reports contain structured result metadata plus one optional derived Grad-CAM
# image. This limit is deliberately below two maximum base64 fields, preventing
# duplicate/crafted report payloads from consuming avoidable serverless memory.
MAX_REPORT_REQUEST_BYTES = 15 * 1024 * 1024
# Inference itself uses 160 px inputs. Keeping decoded uploads below 4 MP limits
# serverless memory pressure while still accepting ordinary exported MRI slices.
MAX_IMAGE_PIXELS = 4_000_000
MIN_CLASSIFICATION_EDGE_PIXELS = 96
MRI_PLAUSIBILITY_SAMPLE_EDGE = 256
MAX_CHROMATIC_PIXEL_FRACTION = 0.02
MIN_LUMINANCE_STANDARD_DEVIATION = 8.0
MIN_LUMINANCE_DYNAMIC_RANGE = 32.0
MIN_DARK_BORDER_FRACTION = 0.12

# Grad-CAM is an explanatory thumbnail, not a diagnostic-resolution artifact.
# Bounding it prevents original-resolution float arrays and oversized base64 JSON.
MAX_GRAD_CAM_EDGE_PIXELS = 512
