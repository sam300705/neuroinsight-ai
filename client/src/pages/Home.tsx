import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

const outputs = {
  en: [
    ["Tumour class", "Four-way classification of the uploaded slice."],
    ["Outline and area", "View the predicted boundary and relative area."],
    [
      "Classifier attention",
      "Grad-CAM shows which regions influenced the classifier.",
    ],
    ["Review flags", "Review low-confidence and disagreement cases."],
  ],
  hi: [
    ["ट्यूमर का वर्ग", "अपलोड की गई स्लाइस का चार-वर्ग वर्गीकरण।"],
    ["रूपरेखा और क्षेत्रफल", "अनुमानित सीमा और सापेक्ष क्षेत्रफल देखें।"],
    [
      "वर्गीकारक अटेंशन",
      "Grad-CAM दिखाता है कि किन क्षेत्रों ने वर्गीकरण को प्रभावित किया।",
    ],
    ["समीक्षा संकेत", "कम कॉन्फिडेंस और मॉडल की असहमति वाले परिणाम देखें।"],
  ],
} as const;

export default function Home() {
  const { language, t } = useLanguage();
  const hindi = language === "hi";

  return (
    <div className="space-y-8">
      <section className="workspace-overview">
        <div className="min-w-0">
          <h1 className="workspace-display">
            {hindi ? "मस्तिष्क MRI का विश्लेषण" : "Brain MRI analysis"}
          </h1>
          <p className="mt-4 max-w-[28rem] text-base leading-relaxed text-[var(--workspace-muted)] lg:text-lg">
            {hindi
              ? "एक 2D स्लाइस अपलोड करें और वर्गीकरण, रूपरेखा, क्षेत्रफल और अनिश्चितता देखें।"
              : "Upload a single 2D slice and review the classification, outline, area, and uncertainty."}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/analyse"
              className="workspace-action workspace-action-primary"
            >
              {t("analyze")}{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/methodology"
              className="workspace-action workspace-action-secondary"
            >
              {t("methodology")}
            </Link>
          </div>
        </div>
        <figure className="workspace-viewer">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <span className="text-sm font-semibold">
              {hindi ? "अक्षीय MRI स्लाइस" : "Axial MRI slice"}
            </span>
            <span className="text-xs text-[var(--viewer-muted)]">2D</span>
          </div>
          <img
            src="/images/axial-mri-illustration.webp"
            alt={
              hindi
                ? "मस्तिष्क की अक्षीय स्लाइस का चित्र"
                : "Illustration of an axial brain MRI slice"
            }
            width={720}
            height={540}
            fetchPriority="high"
            className="h-[220px] w-full object-contain sm:h-[300px]"
          />
          <figcaption className="border-t border-white/10 px-4 py-3 text-xs text-[var(--viewer-muted)]">
            {hindi ? "इनपुट का कृत्रिम उदाहरण" : "Synthetic input illustration"}
          </figcaption>
        </figure>
      </section>
      <section aria-labelledby="analysis-outputs">
        <h2
          id="analysis-outputs"
          className="mb-2 text-2xl font-semibold tracking-tight"
        >
          {hindi ? "विश्लेषण के परिणाम" : "What the analysis shows"}
        </h2>
        <dl>
          {outputs[language].map(([title, detail]) => (
            <div key={title} className="workspace-output-row">
              <dt className="text-sm font-semibold">{title}</dt>
              <dd className="text-sm leading-6 text-[var(--workspace-muted)]">
                {detail}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
