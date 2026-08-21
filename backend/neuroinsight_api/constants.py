ACADEMIC_DISCLAIMER = (
    "Academic and research use only. This prototype does not provide a medical diagnosis "
    "and does not replace qualified clinical review."
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

