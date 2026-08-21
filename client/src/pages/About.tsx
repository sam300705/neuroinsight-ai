import { BrainCircuit, Code2, HeartHandshake } from "lucide-react";
import { AcademicDisclaimer } from "@/components/ResearchDisclaimers";
import { copyFor } from "@/contexts/pageCopy";
import { useLanguage } from "@/contexts/LanguageContext";
const cardIcons = [BrainCircuit, Code2, HeartHandshake];
export default function About() { const { language } = useLanguage(); const text = copyFor(language).about; return <div className="mx-auto max-w-5xl space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">{text.title}</h1><p className="mt-3 max-w-3xl leading-7 text-slate-600">{text.intro}</p></div><AcademicDisclaimer /><div className="grid gap-4 md:grid-cols-3">{text.cards.map(([title, detail], index) => { const Icon = cardIcons[index]!; return <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><Icon className="size-6 text-teal-700" /><h2 className="mt-3 font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p></article>; })}</div></div>; }
