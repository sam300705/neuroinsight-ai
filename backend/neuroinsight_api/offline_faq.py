from __future__ import annotations

from .constants import ACADEMIC_DISCLAIMER, GRAD_CAM_DISCLAIMER
from .schemas import ChatRequest


UNSAFE_TERMS = (
    "medicine", "medication", "surgery", "operate", "treatment", "diagnose", "diagnosis", "cancer",
    "prognosis", "survival", "survive", "staging", "stage", "radiologist replacement", "replace my doctor",
    "इलाज", "दवा", "सर्जरी", "निदान", "कैंसर", "पूर्वानुमान", "जीवित",
)
PROMPT_INJECTION_TERMS = ("system prompt", "hidden prompt", "ignore previous", "ignore all", "safety rules", "act as a doctor", "reveal prompt", "instructions", "प्रॉम्प्ट", "निर्देश")


def unsafe_question_category(question: str) -> str | None:
    normalized = question.strip().lower()
    if any(term in normalized for term in PROMPT_INJECTION_TERMS):
        return "prompt_injection"
    if any(term in normalized for term in UNSAFE_TERMS):
        return "medical_advice"
    return None


def answer_offline(request: ChatRequest) -> str:
    question = request.question.strip().lower()
    hindi = request.language == "hi"
    if unsafe_question_category(question) == "prompt_injection":
        return (
            "मैं छिपे हुए निर्देश, आंतरिक प्रॉम्प्ट या सुरक्षा सीमाएँ प्रकट या बदल नहीं सकता। "
            if hindi
            else "I cannot reveal or alter hidden instructions, internal prompts, or safety boundaries. "
        ) + ACADEMIC_DISCLAIMER
    if unsafe_question_category(question) == "medical_advice":
        return (
            "मैं उपचार, दवा, सर्जरी या निदान की सलाह नहीं दे सकता। कृपया योग्य चिकित्सक से बात करें। "
            if hindi
            else "I cannot advise on treatment, medication, surgery, or diagnosis. Please discuss these questions with a qualified clinician. "
        ) + ACADEMIC_DISCLAIMER
    if request.model_version == "neuroinsight-ai-v3.2":
        if any(word in question for word in ("outline", "size", "area", "volume", "mask", "रूपरेखा")):
            return (
                "v3.2 की अनुमानित 2D रूपरेखा उपलब्ध होने पर क्षेत्रफल पिक्सेल और सापेक्ष प्रतिशत में दिखता है। भौतिक आकार या आयतन उपलब्ध नहीं है। "
                if hindi else
                "When v3.2 finds an outline, it reports pixels and separate percentages of the whole image and estimated brain region. Physical size and volume are unavailable. "
            ) + ACADEMIC_DISCLAIMER
        if request.purpose == "result_summary" or "confidence" in question or "कॉन्फिडेंस" in question:
            if request.combined_finding == "possible_tumor (type unclear)":
                return (
                    "वर्गीकारक ने ट्यूमर नहीं बताया, लेकिन सेगमेंटेशन को एक क्षेत्र मिला। वर्गीकारक का कॉन्फिडेंस उसके अपने निर्णय का है। "
                    if hindi else
                    "The classifier predicted no tumor, but segmentation found a region. Classifier confidence describes its own decision. "
                ) + ACADEMIC_DISCLAIMER
            return (
                "वर्गीकारक का कॉन्फिडेंस उसके चार-वर्ग निर्णय का है। संयुक्त निष्कर्ष में अनुमानित 2D रूपरेखा भी शामिल है। "
                if hindi else
                "Classifier confidence describes the four-way classifier decision. The combined finding also uses the outline model. "
            ) + ACADEMIC_DISCLAIMER
    if "heatmap" in question or "grad" in question:
        return GRAD_CAM_DISCLAIMER
    if "confidence" in question:
        return (
            "मॉडल कॉन्फिडेंस स्कोर मॉडल की आंतरिक निश्चितता का संकेत है; यह चिकित्सीय संभावना नहीं है। "
            if hindi
            else "The model confidence score reflects the model's internal certainty; it is not a medical probability. "
        ) + ACADEMIC_DISCLAIMER
    if "review" in question or "uncertain" in question:
        return (
            "कम कॉन्फिडेंस या संगतता चेतावनी का अर्थ है कि विशेषज्ञ समीक्षा की सलाह दी जाती है। "
            if hindi
            else "A low-confidence or compatibility warning means qualified expert review is recommended. "
        ) + ACADEMIC_DISCLAIMER
    if "size" in question or "area" in question or "volume" in question:
        return (
            "मापन केवल उपलब्ध स्थानिक मेटाडेटा के अनुसार रिपोर्ट किया जाता है; मेटाडेटा के बिना भौतिक इकाइयाँ नहीं दी जातीं। "
            if hindi
            else "Measurements are reported only when the required spatial metadata is available; physical units are not provided without it. "
        ) + ACADEMIC_DISCLAIMER
    return (
        "यह ऑफ़लाइन FAQ केवल उपलब्ध विश्लेषण की सीमाएँ समझा सकता है और कोई निदान नहीं देता। "
        if hindi
        else "This offline FAQ can explain the available analysis and its limitations, but it does not provide a diagnosis. "
    ) + ACADEMIC_DISCLAIMER
