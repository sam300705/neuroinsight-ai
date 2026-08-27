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
# A 12-megapixel RGB image already expands to roughly 36 MB before inference
# intermediates. MRI classification inputs are normally far smaller.
MAX_IMAGE_PIXELS = 12_000_000
