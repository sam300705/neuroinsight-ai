import { AlertTriangle, GraduationCap, ScanSearch } from "lucide-react";
import { ACADEMIC_DISCLAIMER, GLIOMA_SCOPE_DISCLAIMER, GRAD_CAM_DISCLAIMER } from "@shared/neuroinsight";
import { useLanguage } from "@/contexts/LanguageContext";

export function disclaimerCopy(language: "en" | "hi") {
  if (language === "hi") return {
    academic: "केवल अकादमिक और शोध उपयोग के लिए। यह प्रणाली चिकित्सीय निदान नहीं है और योग्य रेडियोलॉजिस्ट का विकल्प नहीं है। This system is not a medical diagnosis and must not replace a qualified radiologist.",
    gradCam: "Grad-CAM वर्गीकार को प्रभावित करने वाले क्षेत्रों का मोटा एट्रिब्यूशन है। यह ट्यूमर की सीमा, कारणात्मक व्याख्या या शुद्धता का प्रमाण नहीं है।",
    glioma: "सेगमेंटेशन आउटपुट केवल संगत NIfTI वॉल्यूम के लिए ग्लायोमा-केंद्रित शोध दायरे में है। इसे सार्वभौमिक ब्रेन-ट्यूमर सेगमेंटेशन या चिकित्सीय निष्कर्ष के रूप में न समझें।",
  };
  return { academic: ACADEMIC_DISCLAIMER, gradCam: GRAD_CAM_DISCLAIMER, glioma: GLIOMA_SCOPE_DISCLAIMER };
}

export function AcademicDisclaimer({ compact = false }: { compact?: boolean }) { const { language } = useLanguage(); const text = disclaimerCopy(language); return <div className={`flex gap-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-950 ${compact ? "px-3 py-2" : "p-4"}`} role="note"><GraduationCap className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><p className={compact ? "text-xs leading-5" : "text-sm leading-6"}>{text.academic}</p></div>; }
export function GradCamDisclaimer() { const { language } = useLanguage(); const text = disclaimerCopy(language); return <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-950" role="note"><ScanSearch className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><p className="text-sm leading-6">{text.gradCam}</p></div>; }
export function GliomaScopeDisclaimer() { const { language } = useLanguage(); const text = disclaimerCopy(language); return <div className="flex gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-violet-950" role="note"><AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><p className="text-sm leading-6">{text.glioma}</p></div>; }
