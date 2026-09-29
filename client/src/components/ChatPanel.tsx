import { SendHorizontal, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { askResearchExplanation, type ResearchExplanationRequest } from "@/lib/inferenceApi";
import { ACADEMIC_DISCLAIMER } from "@shared/neuroinsight";

type Message = { author: "user" | "assistant"; text: string; source?: "offline_faq" | "openai" | "gemini" };

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { language } = useLanguage();
  const { current } = useAnalysis();
  const hindi = language === "hi";
  const context: ResearchExplanationRequest = {
    question: "",
    language,
    purpose: "question",
    predicted_class: current?.predictedClass,
    model_version: current?.modelVersion === "bdneuro-v7-resnet50-head-only-exp005" ? current.modelVersion : undefined,
    model_confidence_score: current?.modelConfidenceScore,
    calibrated: current?.calibrated,
    manual_review_recommended: true,
    grad_cam_available: Boolean(current?.gradCamDataUrl),
    uncertainty_reason: current?.uncertaintyReason,
    measurement_available: false,
  };
  const contextSummary = current?.predictedClass
    ? (hindi ? "केवल व्युत्पन्न शोध संदर्भ: वर्गीकरण और मॉडल कॉन्फिडेंस। फ़ाइल नाम, स्कैन आईडी, छवि और खाते का डेटा नहीं भेजा जाता।" : "Derived research context only: classification and model confidence. No filename, scan ID, image, or account data is sent.")
    : (hindi ? "कोई परिणाम संदर्भ उपलब्ध नहीं है। केवल सामान्य शोध-सीमा FAQ दिया जा सकता है।" : "No result context is available. Only general research-scope FAQ guidance can be given.");
  const send = async (suggestedQuestion?: string) => {
    const question = (suggestedQuestion ?? input).trim();
    if (!question || sending) return;
    setMessages(currentMessages => [...currentMessages, { author: "user", text: question }]);
    setInput("");
    setSending(true);
    const result = await askResearchExplanation({ ...context, question, purpose: suggestedQuestion ? "result_summary" : "question" });
    const answer = result.ok
      ? result.answer
      : `${hindi ? "रिसर्च एक्सप्लेनेशन सर्विस तक पहुँचा नहीं जा सका। कृपया बाद में पुनः प्रयास करें या योग्य रेडियोलॉजिस्ट से बात करें।" : "The research explanation service could not be reached. Please try again later or discuss the result with a qualified radiologist."} ${ACADEMIC_DISCLAIMER}`;
    setMessages(currentMessages => [...currentMessages, { author: "assistant", text: answer, source: result.ok ? result.source : "offline_faq" }]);
    setSending(false);
  };
  const explainResult = () => {
    inputRef.current?.focus();
    void send(hindi ? "उपलब्ध शोध परिणाम और उसकी सीमाएँ समझाइए।" : "Explain the available research result and its limitations.");
  };
  return <section id="research-assistant" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="chat-title">
    <div className="flex items-start justify-between gap-4"><div><h2 id="chat-title" className="text-base font-semibold">{hindi ? "रिसर्च एक्सप्लेनेशन असिस्टेंट" : "Research Explanation Assistant"}</h2><p className="mt-1 text-sm text-slate-600">{hindi ? "केवल शोध-संदर्भ का स्पष्टीकरण। यह निदान या उपचार सलाह नहीं देता।" : "Research-context explanation only. It does not provide diagnosis or treatment advice."}</p></div><ShieldCheck className="size-5 text-teal-700" aria-hidden="true" /></div>
    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600" role="note">{contextSummary}</p>
    <button type="button" onClick={explainResult} disabled={sending} className="mt-3 rounded-lg border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 disabled:opacity-50">{hindi ? "इस परिणाम की व्याख्या करें" : "Explain this result"}</button>
    <div className="mt-4 space-y-3" aria-live="polite">{messages.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{hindi ? "मॉडल कॉन्फिडेंस, Grad-CAM, मैनुअल समीक्षा या सीमाओं के बारे में पूछें। निदान, उपचार और छिपे प्रॉम्प्ट के अनुरोध अस्वीकार किए जाते हैं।" : "Ask about model confidence, Grad-CAM, manual review, or limitations. Requests for diagnosis, treatment, and hidden prompts are refused."}</p> : messages.map((message, index) => <div key={index} className={`rounded-xl p-3 text-sm leading-6 ${message.author === "user" ? "ml-8 bg-teal-800 text-white" : "mr-4 bg-slate-100 text-slate-800"}`}><p>{message.text}</p>{message.author === "assistant" && <p className="mt-2 text-xs text-slate-500">{message.source === "offline_faq" ? (hindi ? "स्रोत: ऑफ़लाइन FAQ" : "Source: offline FAQ") : (hindi ? "स्रोत: सर्वर-साइड संरचित शोध उत्तर" : "Source: server-side structured research response")}</p>}</div>)}</div>
    <div className="mt-4 flex gap-2"><label className="sr-only" htmlFor="chat-question">{hindi ? "संदर्भ प्रश्न पूछें" : "Ask a research-context question"}</label><input ref={inputRef} id="chat-question" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-200" placeholder={hindi ? "शोध परिणाम के बारे में पूछें" : "Ask about this research result"} maxLength={600} /><button type="button" onClick={() => void send()} className="inline-flex size-11 items-center justify-center rounded-xl bg-teal-800 text-white transition hover:bg-teal-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 disabled:opacity-50" aria-label={hindi ? "प्रश्न भेजें" : "Send question"} disabled={!input.trim() || sending}><SendHorizontal className="size-4" /></button></div>
  </section>;
}
