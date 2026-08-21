import { useState } from "react";
import { GradCamDisclaimer } from "@/components/ResearchDisclaimers";
import { useLanguage } from "@/contexts/LanguageContext";

export function GradCamOverlay({ sourceUrl }: { sourceUrl?: string }) {
  const { language } = useLanguage();
  const hindi = language === "hi";
  const [opacity, setOpacity] = useState(0.55);
  if (!sourceUrl) return <section className="space-y-4"><GradCamDisclaimer /><div className="rounded-2xl border border-dashed border-slate-300 bg-white p-7 text-center text-sm text-slate-600">{hindi ? "Grad-CAM ओवरले और अपारदर्शिता नियंत्रण केवल तब यहाँ दिखेंगे जब सत्यापित वर्गीकार वास्तविक एट्रिब्यूशन मैप बनाकर संग्रहीत करे।" : "A Grad-CAM overlay and opacity control will appear here only when a verified classifier produces and stores a real attribution map."}</div></section>;
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><GradCamDisclaimer /><div className="relative mt-4 overflow-hidden rounded-xl bg-slate-950"><img src={sourceUrl} alt={hindi ? "वर्गीकार Grad-CAM मोटा एट्रिब्यूशन ओवरले" : "Classifier Grad-CAM coarse attribution overlay"} className="w-full object-contain" style={{ opacity }} /></div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><label className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="whitespace-nowrap">{hindi ? "ओवरले अपारदर्शिता" : "Overlay opacity"}</span><input type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={event => setOpacity(Number(event.target.value))} className="w-full accent-teal-700" aria-label={hindi ? "Grad-CAM ओवरले अपारदर्शिता" : "Grad-CAM overlay opacity"} /></label><div className="flex items-center gap-2 text-xs text-slate-600"><span className="h-3 w-20 rounded" style={{ background: "linear-gradient(90deg, #1f4ea8, #2fa77e, #d6533c)" }} /><span>{hindi ? "कम से अधिक एट्रिब्यूशन" : "Lower to higher attribution"}</span></div></div></section>;
}
