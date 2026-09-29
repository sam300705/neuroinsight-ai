import { FileLock2, HeartHandshake, Scale, ShieldCheck } from "lucide-react";
import { AcademicDisclaimer } from "@/components/ResearchDisclaimers";
import { useLanguage } from "@/contexts/LanguageContext";

const content = {
  en: {
    title: "Responsible use, privacy, and collaboration",
    intro: "These engineering notes make the research sandbox's data, model, and collaboration boundaries visible. They are draft policy material pending owner and legal review.",
    privacy: "Privacy and data lifecycle",
    privacyDetail: "Raw MRI uploads are not stored by the dashboard by default. Optional history contains account-linked research metadata and derived report/Grad-CAM artifacts only. Removing a history record removes the application reference; the current managed storage helper does not prove provider-side physical erasure.",
    use: "Acceptable use",
    useDetail: "Upload only authorised, non-sensitive research material. Do not upload patient records, personal medical data, private studies, credentials, or restricted datasets. Do not present experimental outputs or Grad-CAM as clinical findings.",
    model: "Model and capability boundary",
    modelDetail: "Mode A EXP-005 is an experimental 2D classifier with fixed-split image-level evidence. Mode B segmentation, volume, physical measurement, and 3D geometry are unavailable and cannot accept uploads.",
    collaborate: "Contact and collaboration",
    collaborateDetail: "Teaching, research, and collaboration discussions must preserve the academic scope. Requests involving clinical use, patient data, model promotion, legal claims, paid infrastructure, or production publication require owner review.",
    draft: "Draft pending owner/legal review",
  },
  hi: {
    title: "जिम्मेदार उपयोग, गोपनीयता और सहयोग",
    intro: "ये इंजीनियरिंग नोट शोध सैंडबॉक्स की डेटा, मॉडल और सहयोग सीमाओं को स्पष्ट करते हैं। ये मालिक और कानूनी समीक्षा तक ड्राफ्ट नीति सामग्री हैं।",
    privacy: "गोपनीयता और डेटा जीवनचक्र",
    privacyDetail: "डैशबोर्ड कच्चे MRI अपलोड को डिफ़ॉल्ट रूप से संग्रहीत नहीं करता। वैकल्पिक इतिहास में केवल खाते से जुड़ा शोध मेटाडेटा और व्युत्पन्न रिपोर्ट/Grad-CAM आर्टिफैक्ट होते हैं। इतिहास रिकॉर्ड हटाने से एप्लिकेशन संदर्भ हटता है; वर्तमान प्रबंधित स्टोरेज सहायक प्रदाता-पक्ष भौतिक मिटाव सिद्ध नहीं करता।",
    use: "स्वीकार्य उपयोग",
    useDetail: "केवल अधिकृत, गैर-संवेदनशील शोध सामग्री अपलोड करें। रोगी रिकॉर्ड, व्यक्तिगत चिकित्सा डेटा, निजी अध्ययन, क्रेडेंशियल या प्रतिबंधित डेटासेट अपलोड न करें। प्रायोगिक आउटपुट या Grad-CAM को क्लिनिकल निष्कर्ष के रूप में प्रस्तुत न करें।",
    model: "मॉडल और क्षमता सीमा",
    modelDetail: "मोड A EXP-005 निश्चित छवि-स्तर प्रमाण वाला प्रायोगिक 2D वर्गीकार है। मोड B सेगमेंटेशन, वॉल्यूम, भौतिक मापन और 3D ज्यामिति अनुपलब्ध हैं और अपलोड स्वीकार नहीं कर सकते।",
    collaborate: "संपर्क और सहयोग",
    collaborateDetail: "शिक्षण, शोध और सहयोग चर्चा को अकादमिक दायरा बनाए रखना चाहिए। क्लिनिकल उपयोग, रोगी डेटा, मॉडल प्रमोशन, कानूनी दावे, सशुल्क अवसंरचना या उत्पादन प्रकाशन वाले अनुरोधों के लिए मालिक समीक्षा आवश्यक है।",
    draft: "मालिक/कानूनी समीक्षा लंबित ड्राफ्ट",
  },
} as const;

export default function ResponsibleUse() {
  const { language } = useLanguage();
  const text = content[language];
  const cards = [[ShieldCheck, text.privacy, text.privacyDetail], [Scale, text.use, text.useDetail], [FileLock2, text.model, text.modelDetail], [HeartHandshake, text.collaborate, text.collaborateDetail]] as const;
  return <div className="mx-auto max-w-5xl space-y-6"><header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">{text.draft}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{text.title}</h1><p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{text.intro}</p></header><AcademicDisclaimer /><section className="grid gap-4 md:grid-cols-2">{cards.map(([Icon, title, detail]) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-800"><Icon className="size-5" /></span><h2 className="mt-4 text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p></article>)}</section></div>;
}
