import { Box } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function UnavailableGeometry() {
  const { language } = useLanguage();
  const hindi = language === "hi";
  return <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6" aria-labelledby="viewer-title"><div className="flex gap-3"><Box className="mt-0.5 size-6 text-teal-800" aria-hidden="true" /><div><h2 id="viewer-title" className="text-lg font-semibold">{hindi ? "संगत 3D ज्यामिति अनुपलब्ध" : "Compatible 3D geometry unavailable"}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{hindi ? "रोटेट, ज़ूम, अपारदर्शिता और हाइलाइटिंग व्यूअर केवल तब सक्षम होगा जब सत्यापित पूर्ण-वॉल्यूम सेगमेंटेशन सेवा इस स्कैन के लिए संगत GLB ज्यामिति संग्रहीत करे। डैशबोर्ड कोई एल्गोरिथ्मिक ज्यामिति अनुमानित नहीं करता।" : "A rotate, zoom, opacity, and highlighting viewer will be enabled only after a validated full-volume segmentation service stores compatible GLB geometry for this scan. The dashboard does not estimate geometry."}</p><p className="mt-3 text-xs leading-5 text-slate-500">{hindi ? "यहाँ दिखाई जाने वाली कोई भी भविष्य की ज्यामिति अनुमानित शोध आउटपुट होगी, शारीरिक या चिकित्सीय ग्राउंड ट्रुथ नहीं।" : "Any future stored geometry would be an estimated research output, not anatomical or clinical ground truth."}</p></div></div></section>;
}
