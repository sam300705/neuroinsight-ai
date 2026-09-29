import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "en" | "hi";

const copy = {
  en: { navigation: "Navigation", analyze: "Analyse scan", results: "Results", history: "Scan history", methodology: "Methodology", performance: "Model performance", limitations: "Limitations", responsible: "Responsible use", about: "About project", academic: "Academic and research use only — not a medical diagnosis.", language: "हिंदी", home: "Overview", skip: "Skip to main content", toggleNavigation: "Toggle navigation", switchLanguage: "Switch language to Hindi" },
  hi: { navigation: "नेविगेशन", analyze: "स्कैन विश्लेषण", results: "परिणाम", history: "स्कैन इतिहास", methodology: "कार्यप्रणाली", performance: "मॉडल प्रदर्शन", limitations: "सीमाएँ", responsible: "जिम्मेदार उपयोग", about: "परियोजना के बारे में", academic: "केवल शैक्षणिक और शोध उपयोग के लिए — यह चिकित्सीय निदान नहीं है।", language: "English", home: "अवलोकन", skip: "मुख्य सामग्री पर जाएँ", toggleNavigation: "नेविगेशन बदलें", switchLanguage: "भाषा को अंग्रेज़ी में बदलें" },
} as const;

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (key: keyof (typeof copy)["en"]) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem("neuroinsight-language") === "hi" ? "hi" : "en");
  useEffect(() => { document.documentElement.lang = language === "hi" ? "hi" : "en"; }, [language]);
  const value = useMemo(() => ({ language, setLanguage: (next: Language) => { localStorage.setItem("neuroinsight-language", next); setLanguage(next); }, t: (key: keyof (typeof copy)["en"]) => copy[language][key] }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() { const value = useContext(LanguageContext); if (!value) throw new Error("useLanguage must be used within LanguageProvider"); return value; }
