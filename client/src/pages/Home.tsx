import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Focus,
  Layers3,
  ScanLine,
  ShieldAlert,
} from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

const features = [
  {
    icon: BrainCircuit,
    en: [
      "Tumour type",
      "Glioma, meningioma, pituitary tumour or no tumour detected.",
    ],
    hi: [
      "ट्यूमर का वर्ग",
      "ग्लायोमा, मेनिन्जियोमा, पिट्यूटरी ट्यूमर या कोई ट्यूमर नहीं मिला।",
    ],
  },
  {
    icon: ScanLine,
    en: [
      "Outline and area",
      "Inspect the predicted outline and its relative area on the slice.",
    ],
    hi: [
      "रूपरेखा और क्षेत्रफल",
      "स्लाइस पर अनुमानित रूपरेखा और उसका सापेक्ष क्षेत्रफल देखें।",
    ],
  },
  {
    icon: Focus,
    en: [
      "Attention map",
      "See which regions influenced the classifier with Grad-CAM.",
    ],
    hi: [
      "अटेंशन मैप",
      "Grad-CAM से देखें कि किन क्षेत्रों ने वर्गीकरण को प्रभावित किया।",
    ],
  },
  {
    icon: ShieldAlert,
    en: [
      "Review flags",
      "See when low confidence or model disagreement calls for review.",
    ],
    hi: [
      "समीक्षा संकेत",
      "कम कॉन्फिडेंस या मॉडल की असहमति होने पर समीक्षा का कारण देखें।",
    ],
  },
] as const;

export default function Home() {
  const { language, t } = useLanguage();
  const hindi = language === "hi";

  return (
    <div className="space-y-7 sm:space-y-9">
      <section className="workspace-hero grid gap-7 rounded-[1.75rem] p-6 sm:p-9 lg:grid-cols-[1.06fr_.94fr] lg:items-center lg:gap-12 lg:p-12">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1.5 text-xs font-semibold text-sky-100">
            <Activity className="size-3.5" aria-hidden="true" />
            {hindi ? "MRI शोध · v3.2" : "MRI research · v3.2"}
          </p>
          <h1 className="mt-6 max-w-xl text-[clamp(2.6rem,6vw,4.7rem)] font-semibold leading-[.99] tracking-[-.055em]">
            {hindi ? "मस्तिष्क MRI का विश्लेषण करें" : "Brain MRI analysis"}
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300 sm:text-lg">
            {hindi
              ? "एक 2D स्लाइस अपलोड करें और मॉडल का वर्गीकरण, रूपरेखा, क्षेत्रफल और समीक्षा संकेत देखें।"
              : "Upload one 2D slice to review the model’s classification, predicted outline, area and uncertainty."}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/analyse"
              className="workspace-hero-action inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
            >
              {t("analyze")}{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/methodology"
              className="rounded-xl border border-slate-500 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              {t("methodology")}
            </Link>
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm leading-5 text-slate-300">
            <ShieldAlert
              className="size-4 shrink-0 text-sky-200"
              aria-hidden="true"
            />
            {t("academic")}
          </p>
        </div>
        <figure className="overflow-hidden rounded-2xl border border-sky-200/25 bg-[#080e1b]">
          <div className="flex items-center gap-2 border-b border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200">
            <Layers3 className="size-4 text-sky-200" aria-hidden="true" />
            {hindi ? "अक्षीय MRI स्लाइस" : "Axial MRI slice"}
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
            className="aspect-[4/3] max-h-[22rem] w-full object-contain"
          />
          <figcaption className="border-t border-white/15 px-4 py-2.5 text-xs text-slate-300">
            {hindi ? "इनपुट का कृत्रिम उदाहरण" : "Synthetic input illustration"}
          </figcaption>
        </figure>
      </section>
      <section aria-labelledby="analysis-outputs">
        <h2
          id="analysis-outputs"
          className="mb-4 text-xl font-semibold tracking-tight sm:text-2xl"
        >
          {hindi ? "विश्लेषण के परिणाम" : "What the analysis shows"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, ...labels }) => {
            const [title, detail] = labels[language];
            return (
              <article key={title} className="workspace-panel p-5">
                <span className="grid size-10 place-items-center rounded-xl bg-blue-100 text-blue-800">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                  {detail}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
