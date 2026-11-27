import { useState } from "react";
import type { InferenceAnalysisResponse } from "@/lib/inferenceApi";
import { useLanguage } from "@/contexts/LanguageContext";
import type { V32Finding } from "@shared/v32Finding";

const labels = {
  en: {
    glioma: "Glioma",
    meningioma: "Meningioma",
    pituitary: "Pituitary tumor",
    no_tumor: "No tumor detected",
    "possible_tumor (type unclear)": "Possible tumor — type unclear",
  },
  hi: {
    glioma: "ग्लायोमा",
    meningioma: "मेनिन्जियोमा",
    pituitary: "पिट्यूटरी ट्यूमर",
    no_tumor: "ट्यूमर का पता नहीं चला",
    "possible_tumor (type unclear)": "संभावित ट्यूमर — प्रकार अस्पष्ट",
  },
};

export function findingLabel(
  label: V32Finding["final_label"],
  language: "en" | "hi"
) {
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
  const text = hindi
    ? {
        slice: "MRI स्लाइस की समीक्षा",
        unavailableValue: "उपलब्ध नहीं",
        original: "मूल MRI स्लाइस",
        outline: "अनुमानित 2D रूपरेखा",
        classifier: "वर्गीकारक का निर्णय",
        noTumor: "ट्यूमर नहीं",
        confidence: "वर्गीकारक का कॉन्फिडेंस",
        confidenceNote: "यह मॉडल का स्कोर है, चिकित्सीय जोखिम का अनुमान नहीं।",
        review: "समीक्षा के कारण",
        uncertain: "रूपरेखा अनिश्चित है।",
        unavailable: "2D क्षेत्रफल का अनुमान उपलब्ध नहीं है।",
        pixels: "रूपरेखा के पिक्सेल",
        image: "पूरी छवि का प्रतिशत",
        brain: "अनुमानित मस्तिष्क क्षेत्र का प्रतिशत",
        attention: "वर्गीकारक का अटेंशन",
        attentionNote:
          "Grad-CAM क्रॉप किए गए इनपुट के उन क्षेत्रों को दिखाता है जिन्होंने वर्गीकरण को प्रभावित किया। अलग रूपरेखा क्षेत्र की सीमा का अनुमान दिखाती है।",
        disagreement:
          "वर्गीकारक ने ट्यूमर नहीं बताया, लेकिन सेगमेंटेशन को एक क्षेत्र मिला।",
        noOutline: "वर्गीकारक ने ट्यूमर बताया, लेकिन कोई रूपरेखा नहीं मिली।",
        lowConfidence: "वर्गीकारक का कॉन्फिडेंस कम है।",
      }
    : {
        slice: "MRI slice review",
        unavailableValue: "Unavailable",
        original: "Original MRI slice",
        outline: "Predicted 2D outline",
        classifier: "Classifier decision",
        noTumor: "No tumor",
        confidence: "Classifier confidence",
        confidenceNote:
          "Confidence is a model score, not an estimate of clinical risk.",
        review: "Review reasons",
        uncertain: "The predicted outline is uncertain.",
        unavailable: "2D area estimate unavailable.",
        pixels: "Outline area in pixels",
        image: "Percentage of the whole image",
        brain: "Percentage of the estimated brain region",
        attention: "Classifier attention",
        attentionNote:
          "Grad-CAM highlights regions that influenced classification on the cropped input. The separate outline estimates the region’s boundary.",
        disagreement:
          "The classifier predicted no tumor, but segmentation found a region.",
        noOutline:
          "The classifier predicted a tumor, but segmentation found no outline.",
        lowConfidence: "The classifier confidence is low.",
      };
  const overlay =
    finding.overlay_png_base64 &&
    `data:image/png;base64,${finding.overlay_png_base64}`;
  const showingOverlay = showOutline && Boolean(overlay);
  const displayedSlice = showingOverlay ? overlay : previewUrl;

  function percent(value: number | null) {
    return value === null ? text.unavailableValue : `${value.toFixed(2)}%`;
  }

  function reviewReason(reason: string) {
    if (reason.startsWith("low classifier confidence"))
      return text.lowConfidence;
    if (reason.startsWith("classifier: no_tumor")) return text.disagreement;
    if (reason.includes("segmentation found no tumor region"))
      return text.noOutline;
    return reason;
  }

  return (
    <>
      <section className="grid items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="overflow-hidden rounded-[1.125rem] border border-slate-700 bg-[#080e1b] text-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 px-4 py-3 sm:px-5">
            <h2 className="font-semibold">{text.slice}</h2>
            {overlay && previewUrl && (
              <button
                type="button"
                aria-pressed={showingOverlay}
                onClick={() => setShowOutline(value => !value)}
                className="rounded-lg border border-sky-200/40 px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-300/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200 aria-pressed:bg-sky-300/20"
              >
                {text.outline}
              </button>
            )}
          </div>
          {displayedSlice ? (
            <figure>
              <img
                src={displayedSlice}
                alt={showingOverlay ? text.outline : text.original}
                className="max-h-[29rem] min-h-52 w-full object-contain"
              />
              <figcaption className="flex flex-wrap justify-between gap-2 border-t border-white/15 px-4 py-3 text-sm text-slate-300 sm:px-5">
                <span>{showingOverlay ? text.outline : text.original}</span>
                <span className="tabular-nums">
                  {finding.image.width} × {finding.image.height} px
                </span>
              </figcaption>
            </figure>
          ) : (
            <p className="p-5 text-sm text-slate-300">
              {text.unavailableValue}
            </p>
          )}
        </div>

        <div className="workspace-panel p-5 sm:p-6">
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-sm text-slate-600">{text.classifier}</dt>
              <dd className="mt-1 font-semibold">
                {finding.class === "no_tumor"
                  ? text.noTumor
                  : findingLabel(finding.class, language)}
              </dd>
            </div>
            <div className="rounded-xl bg-blue-50 p-4">
              <dt className="text-sm text-slate-600">{text.confidence}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-blue-950">
                {(finding.confidence * 100).toFixed(1)}%
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-slate-600">
            {text.confidenceNote}
          </p>
          {finding.tumor_area_px !== null ? (
            <dl className="mt-5 divide-y divide-slate-100 border-t border-slate-100 text-sm">
              {[
                [text.brain, percent(finding.tumor_pct_of_brain)],
                [text.image, percent(finding.tumor_pct_of_image)],
                [
                  text.pixels,
                  finding.tumor_area_px.toLocaleString(
                    language === "hi" ? "hi-IN" : "en"
                  ),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-4 py-3"
                >
                  <dt className="text-slate-600">{label}</dt>
                  <dd className="shrink-0 font-semibold tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
              {text.unavailable}
            </p>
          )}
          {(finding.mask_uncertain || finding.needs_review) && (
            <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <h2 className="font-semibold">{text.review}</h2>
              {finding.mask_uncertain && (
                <p className="mt-1">{text.uncertain}</p>
              )}
              {finding.review_reasons.length > 0 && (
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {finding.review_reasons.map(reason => (
                    <li key={reason}>{reviewReason(reason)}</li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </section>
      {analysis.grad_cam_png_base64 && (
        <section className="workspace-panel grid items-center gap-4 p-5 sm:grid-cols-[minmax(10rem,15rem)_1fr] sm:p-6">
          <img
            className="w-full max-w-60 rounded-xl bg-slate-950"
            src={`data:image/png;base64,${analysis.grad_cam_png_base64}`}
            alt={text.attention}
          />
          <div>
            <h2 className="text-lg font-semibold">{text.attention}</h2>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">
              {text.attentionNote}
            </p>
          </div>
        </section>
      )}
    </>
  );
}
