import { GliomaScopeDisclaimer } from "@/components/ResearchDisclaimers";
import type { Measurement } from "@shared/neuroinsight";
import { useLanguage } from "@/contexts/LanguageContext";

export function SegmentationOverlay({ sourceUrl, measurement }: { sourceUrl?: string; measurement?: Measurement }) {
  const { language } = useLanguage();
  const hindi = language === "hi";
  const unavailable = hindi ? "अनुपलब्ध" : "Unavailable";
  const label = measurement?.kind === "physical_volume" ? `${measurement.value} ${measurement.unit}` : measurement?.kind === "physical_area" ? `${measurement.value} ${measurement.unit}` : measurement?.kind === "relative_area" ? `${measurement.pixelCount ?? unavailable} ${hindi ? "पिक्सेल" : "pixels"} · ${measurement.occupancyPercent ?? unavailable}% ${hindi ? "ऑक्यूपेंसी" : "occupancy"}` : hindi ? "कोई सत्यापित मास्क मापन नहीं" : "No validated mask measurement";
  if (!sourceUrl) return <section className="space-y-4"><GliomaScopeDisclaimer /><div className="rounded-2xl border border-dashed border-slate-300 bg-white p-7 text-center text-sm text-slate-600">{hindi ? "2D मास्क ओवरले और मापन केवल तब दिखेंगे जब संगत वॉल्यूम वास्तविक सेगमेंटेशन मास्क बनाए और संग्रहीत करे। भौतिक इकाइयों के लिए पुष्ट स्पेसिंग मेटाडेटा आवश्यक है।" : "A 2D mask overlay and measurement appear here only after a compatible volume produces and stores a real segmentation mask. Physical units require confirmed spacing metadata."}</div></section>;
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><GliomaScopeDisclaimer /><img src={sourceUrl} alt={hindi ? "ग्लायोमा-केंद्रित सेगमेंटेशन मास्क ओवरले" : "Glioma-focused segmentation mask overlay"} className="mt-4 max-h-[32rem] w-full rounded-xl bg-slate-950 object-contain" /><div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{hindi ? "शोध मापन" : "Research measurement"}</p><p className="mt-2 font-semibold text-slate-800">{label}</p><p className="mt-2 text-xs leading-5 text-slate-600">{measurement?.limitation ?? (hindi ? "सत्यापित मेटाडेटा मिलने तक मास्क मापन अनुपलब्ध रहते हैं।" : "Mask measurements remain unavailable until validated metadata is supplied.")}</p></div></section>;
}
