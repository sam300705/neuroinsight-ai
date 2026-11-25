import { useState } from "react";
import type { InferenceAnalysisResponse } from "@/lib/inferenceApi";
import { useLanguage } from "@/contexts/LanguageContext";
import type { V32Finding } from "@shared/v32Finding";

const labels = {
  en: {
    glioma: "Glioma",
    meningioma: "Meningioma",
    pituitary: "Pituitary tumor",
    no_tumor: "No tumor detected on this slice",
    "possible_tumor (type unclear)": "Possible tumor — type unclear",
  },
  hi: {
    glioma: "ग्लायोमा",
    meningioma: "मेनिन्जियोमा",
    pituitary: "पिट्यूटरी ट्यूमर",
    no_tumor: "इस स्लाइस में ट्यूमर का पता नहीं चला",
    "possible_tumor (type unclear)": "संभावित ट्यूमर — प्रकार अस्पष्ट",
  },
};

export function findingLabel(label: V32Finding["final_label"], language: "en" | "hi") {
  return labels[language][label];
}

type Props = {
  analysis: InferenceAnalysisResponse & { finding: V32Finding };
  previewUrl?: string;
};

export function V32Result({ analysis, previewUrl }: Props) {
  const { language } = useLanguage();
  const finding = analysis.finding;
  const [showOutline, setShowOutline] = useState(true);
  const hindi = language === "hi";
  const text = hindi ? {
    original: "मूल MRI स्लाइस",
    outline: "अनुमानित 2D रूपरेखा",
    classifier: "वर्गीकारक का निर्णय",
    noTumor: "ट्यूमर नहीं",
    confidence: "वर्गीकारक का कॉन्फिडेंस",
    confidenceNote: "यह स्कोर चार वर्गों में से चुने गए वर्ग का है।",
    negativeNote: "वर्गीकारक का कॉन्फिडेंस अधिक होने पर भी मॉडल इस स्लाइस में ट्यूमर को पहचानने से चूक सकता है।",
    review: "समीक्षा के कारण",
    uncertain: "रूपरेखा अनिश्चित है।",
    unavailable: "2D क्षेत्रफल का अनुमान उपलब्ध नहीं है।",
    pixels: "रूपरेखा के पिक्सेल",
    image: "पूरी छवि का प्रतिशत",
    brain: "अनुमानित मस्तिष्क क्षेत्र का प्रतिशत",
    attention: "वर्गीकारक का अटेंशन",
    attentionNote: "क्रॉप और पैड किए गए वर्गीकारक इनपुट पर अटेंशन।",
    disagreement: "वर्गीकारक ने ट्यूमर नहीं बताया, लेकिन सेगमेंटेशन को एक क्षेत्र मिला।",
    noOutline: "वर्गीकारक ने ट्यूमर बताया, लेकिन कोई रूपरेखा नहीं मिली।",
    lowConfidence: "वर्गीकारक का कॉन्फिडेंस कम है।",
  } : {
    original: "Original MRI slice",
    outline: "Predicted 2D outline",
    classifier: "Classifier decision",
    noTumor: "No tumor",
    confidence: "Classifier confidence",
    confidenceNote: "This score describes the classifier’s four-way decision.",
    negativeNote: "The model can miss tumors on a slice, even when classifier confidence is high.",
    review: "Review reasons",
    uncertain: "The predicted outline is uncertain.",
    unavailable: "2D area estimate unavailable.",
    pixels: "Outline area in pixels",
    image: "Percentage of the whole image",
    brain: "Percentage of the estimated brain region",
    attention: "Classifier attention",
    attentionNote: "Attention over the classifier’s cropped and padded input.",
    disagreement: "The classifier predicted no tumor, but segmentation found a region.",
    noOutline: "The classifier predicted a tumor, but segmentation found no outline.",
    lowConfidence: "The classifier confidence is low.",
  };
  const overlay = finding.overlay_png_base64 && `data:image/png;base64,${finding.overlay_png_base64}`;
  const showingOverlay = showOutline && Boolean(overlay);
  const displayedSlice = showingOverlay ? overlay : previewUrl;

  function reviewReason(reason: string) {
    if (reason.startsWith("low classifier confidence")) return text.lowConfidence;
    if (reason.startsWith("classifier: no_tumor")) return text.disagreement;
    if (reason.includes("segmentation found no tumor region")) return text.noOutline;
    return reason;
  }

  return <>
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        {overlay && <button type="button" aria-pressed={showingOverlay}
          onClick={() => setShowOutline(value => !value)}
          className="mb-4 rounded-lg border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-900">
          {text.outline}
        </button>}
        {displayedSlice && <img src={displayedSlice} alt={showingOverlay ? text.outline : text.original}
          className="max-h-96 w-full rounded-xl bg-slate-950 object-contain" />}
      </div>
      <div className="space-y-3 rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-teal-800">{analysis.model_version}</p>
        {finding.final_label === "no_tumor" &&
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{text.negativeNote}</p>}
        <dl className="space-y-3 text-sm">
          <div><dt className="font-semibold">{text.classifier}</dt><dd>{finding.class === "no_tumor"
            ? text.noTumor : findingLabel(finding.class, language)}</dd></div>
          <div><dt className="font-semibold">{text.confidence}</dt><dd>{`${(finding.confidence * 100).toFixed(1)}%`}. {text.confidenceNote}</dd></div>
          {finding.tumor_area_px !== null && <>
            <div><dt className="font-semibold">{text.pixels}</dt><dd>{finding.tumor_area_px}</dd></div>
            <div><dt className="font-semibold">{text.image}</dt><dd>{finding.tumor_pct_of_image?.toFixed(2)}%</dd></div>
            <div><dt className="font-semibold">{text.brain}</dt><dd>{finding.tumor_pct_of_brain?.toFixed(2)}%</dd></div>
          </>}
        </dl>
        {finding.tumor_area_px === null && <p>{text.unavailable}</p>}
        {finding.mask_uncertain && <p className="text-amber-900">{text.uncertain}</p>}
        {finding.needs_review && <div className="text-amber-900">
          <h2 className="font-semibold">{text.review}</h2>
          <ul className="list-disc pl-5">{finding.review_reasons.map(reason =>
            <li key={reason}>{reviewReason(reason)}</li>)}</ul>
        </div>}
      </div>
    </section>
    {analysis.grad_cam_png_base64 && <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{text.attention}</h2>
      <p className="text-sm text-slate-700">{text.attentionNote}</p>
      <img className="mt-4 w-full max-w-xs rounded-xl"
        src={`data:image/png;base64,${analysis.grad_cam_png_base64}`} alt={text.attention} />
    </section>}
  </>;
}
