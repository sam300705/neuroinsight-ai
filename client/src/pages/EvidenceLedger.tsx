import { CheckCircle2, CircleDashed, Download, FileCheck2, Network, ShieldQuestion, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { AcademicDisclaimer } from "@/components/ResearchDisclaimers";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  evidenceLedger,
  evidenceStateCounts,
  exportEvidenceLedger,
  type EvidenceState,
} from "@/lib/evidenceLedger";
import { evidenceGraph, exportEvidenceGraph } from "@/lib/evidenceGraph";

const copy = {
  en: {
    eyebrow: "Claim-to-Evidence Ledger",
    title: "Every capability must show its evidence — including missing evidence",
    intro: "A versioned, exportable factsheet for the current research release. It deliberately avoids a single trust score because strong evidence in one dimension must not hide a missing external, subgroup, OOD, or prospective evaluation.",
    demonstrated: "Demonstrated",
    conditional: "Conditional",
    notEstablished: "Not established",
    all: "All evidence",
    export: "Export ledger JSON",
    exportGraph: "Export evidence graph",
    evidence: "Evidence",
    boundary: "Claim boundary",
    guidance: "Reporting-aligned, not compliance-certified",
    guidanceDetail: "The structure is inspired by transparency and reproducibility principles in CLAIM 2024 and TRIPOD+AI. NeuroInsight does not claim formal checklist compliance, regulatory approval, or clinical readiness.",
    claimPolicy: "Evidence policy",
    claimPolicyDetail: "Code existence is not enough. A capability is marked demonstrated only when the repository contains the corresponding implementation and declared release evidence. Environment-dependent capabilities stay conditional. Missing scientific evidence stays visible as not established.",
    graphTitle: "Evidence provenance graph",
    graphIntro: "Trace how audited data, the EXP-005 experiment, calibration, runtime, release truth, and portable result evidence relate. Connectivity is provenance, not a trust score.",
    graphRelations: "Declared relationships",
  },
  hi: {
    eyebrow: "Claim-to-Evidence Ledger",
    title: "हर capability के साथ उसका evidence दिखेगा — missing evidence भी",
    intro: "Current research release के लिए versioned, exportable factsheet। एक single trust score जानबूझकर नहीं दिया जाता, क्योंकि एक dimension की strong evidence external, subgroup, OOD या prospective evaluation की कमी को छिपा नहीं सकती।",
    demonstrated: "Demonstrated",
    conditional: "Conditional",
    notEstablished: "Not established",
    all: "सभी evidence",
    export: "Ledger JSON export करें",
    exportGraph: "Evidence graph export करें",
    evidence: "Evidence",
    boundary: "Claim boundary",
    guidance: "Reporting-aligned, compliance-certified नहीं",
    guidanceDetail: "Structure CLAIM 2024 और TRIPOD+AI की transparency/reproducibility principles से inspired है। NeuroInsight formal checklist compliance, regulatory approval या clinical readiness claim नहीं करता।",
    claimPolicy: "Evidence policy",
    claimPolicyDetail: "केवल code होना पर्याप्त नहीं है। Capability को demonstrated तभी mark किया जाता है जब repository में implementation और declared release evidence दोनों हों। Environment-dependent capabilities conditional रहती हैं और missing scientific evidence not established के रूप में visible रहती है।",
    graphTitle: "Evidence provenance graph",
    graphIntro: "Audited data, EXP-005 experiment, calibration, runtime, release truth और portable result evidence का संबंध trace करें। Connectivity provenance है, trust score नहीं।",
    graphRelations: "Declared relationships",
  },
} as const;

const stateOrder: Array<EvidenceState | "all"> = ["all", "demonstrated", "conditional", "not_established"];
const stateStyles: Record<EvidenceState, string> = {
  demonstrated: "border-emerald-200 bg-emerald-50 text-emerald-950",
  conditional: "border-amber-200 bg-amber-50 text-amber-950",
  not_established: "border-slate-200 bg-slate-50 text-slate-800",
};

function downloadJson(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function EvidenceLedger() {
  const { language } = useLanguage();
  const text = copy[language];
  const [filter, setFilter] = useState<EvidenceState | "all">("all");
  const counts = evidenceStateCounts();
  const entries = useMemo(() => filter === "all" ? evidenceLedger : evidenceLedger.filter(entry => entry.state === filter), [filter]);
  const labelFor = (state: EvidenceState | "all") => state === "all" ? text.all : state === "demonstrated" ? text.demonstrated : state === "conditional" ? text.conditional : text.notEstablished;
  const countFor = (state: EvidenceState | "all") => state === "all" ? evidenceLedger.length : counts[state];

  return <div className="mx-auto max-w-6xl space-y-6">
    <section className="overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_85%_10%,_rgba(20,184,166,0.22),_transparent_32%),linear-gradient(135deg,_#071c24,_#0b3437)] p-7 text-white shadow-xl sm:p-10">
      <div className="flex items-center gap-2 text-teal-200"><FileCheck2 className="size-5" /><p className="text-xs font-semibold uppercase tracking-[0.17em]">{text.eyebrow}</p></div>
      <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl">{text.title}</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">{text.intro}</p>
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <Metric icon={<CheckCircle2 className="size-5" />} value={counts.demonstrated} label={text.demonstrated} />
        <Metric icon={<CircleDashed className="size-5" />} value={counts.conditional} label={text.conditional} />
        <Metric icon={<XCircle className="size-5" />} value={counts.not_established} label={text.notEstablished} />
      </div>
    </section>

    <AcademicDisclaimer />

    <section className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-2xl border border-teal-200 bg-teal-50 p-5 text-teal-950"><h2 className="font-semibold">{text.guidance}</h2><p className="mt-2 text-sm leading-6">{text.guidanceDetail}</p><div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold"><a href="https://pubs.rsna.org/doi/10.1148/ryai.240300" target="_blank" rel="noreferrer" className="underline decoration-teal-400 underline-offset-4">CLAIM 2024</a><a href="https://www.bmj.com/content/385/bmj-2023-078378" target="_blank" rel="noreferrer" className="underline decoration-teal-400 underline-offset-4">TRIPOD+AI</a></div></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">{text.claimPolicy}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{text.claimPolicyDetail}</p></article>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Evidence filter">
          {stateOrder.map(state => <button key={state} type="button" onClick={() => setFilter(state)} aria-pressed={filter === state} className={`rounded-full px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${filter === state ? "bg-teal-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{labelFor(state)} · {countFor(state)}</button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => downloadJson("neuroinsight-evidence-ledger-2026-09-11.json", exportEvidenceLedger())} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"><Download className="size-4" />{text.export}</button>
          <button type="button" onClick={() => downloadJson("neuroinsight-evidence-graph-2026-09-11.json", exportEvidenceGraph())} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"><Network className="size-4" />{text.exportGraph}</button>
        </div>
      </div>
    </section>

    <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-xl sm:p-8">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-400/10 text-teal-300"><Network className="size-5" /></span>
        <div><h2 className="text-xl font-semibold">{text.graphTitle}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{text.graphIntro}</p></div>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {evidenceGraph.nodes.map(node => <article key={node.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-300">{node.kind}</p><h3 className="mt-1 font-semibold">{node.label}</h3></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${node.state === "demonstrated" ? "bg-emerald-400/15 text-emerald-200" : node.state === "conditional" ? "bg-amber-400/15 text-amber-200" : "bg-slate-700 text-slate-200"}`}>{labelFor(node.state)}</span></div>
          <p className="mt-3 text-xs leading-5 text-slate-300">{node.detail}</p>
        </article>)}
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <h3 className="text-sm font-semibold text-teal-200">{text.graphRelations}</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {evidenceGraph.edges.map(edge => <p key={`${edge.from}-${edge.to}-${edge.relation}`} className="text-xs leading-5 text-slate-300"><code className="text-slate-100">{edge.from}</code> <span className="text-teal-300">→ {edge.relation} →</span> <code className="text-slate-100">{edge.to}</code></p>)}
        </div>
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-2">
      {entries.map(entry => <article key={entry.id} className={`rounded-2xl border p-5 shadow-sm ${stateStyles[entry.state]}`}>
        <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-700">{entry.category}</p><h2 className="mt-2 text-lg font-semibold">{entry.title}</h2></div><StateIcon state={entry.state} /></div>
        <div className="mt-4 rounded-xl bg-white/80 p-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-700">{text.evidence}</p><p className="mt-2 text-sm leading-6">{entry.evidence}</p></div>
        <div className="mt-3 border-t border-slate-300 pt-3"><p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-700">{text.boundary}</p><p className="mt-2 text-sm leading-6">{entry.boundary}</p></div>
      </article>)}
    </section>
  </div>;
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2 text-teal-200">{icon}<span className="text-xs font-semibold uppercase tracking-[0.1em]">{label}</span></div><p className="mt-2 text-3xl font-semibold">{value}</p></div>;
}

function StateIcon({ state }: { state: EvidenceState }) {
  return <span role="img" className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/80 text-slate-800" aria-label={state.replace("_", " ")}>{state === "demonstrated" ? <CheckCircle2 className="size-5" /> : state === "conditional" ? <CircleDashed className="size-5" /> : <ShieldQuestion className="size-5" />}</span>;
}
