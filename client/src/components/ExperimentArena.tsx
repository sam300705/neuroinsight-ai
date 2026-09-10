import { Download, FlaskConical, ShieldCheck, ShieldX } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  currentExperimentPromotionReview,
  experimentComparisonRecords,
  exportExperimentComparison,
} from "@/lib/experimentComparison";

const copy = {
  en: {
    eyebrow: "Experiment Arena",
    title: "Compare evidence before promoting a model",
    intro: "EXP-005 and EXP-006 are compared on declared held-out evidence and release gates. A newer or stronger validation score does not automatically replace the deployed research model.",
    metric: "Evidence dimension",
    incumbent: "EXP-005 · active Mode A",
    candidate: "EXP-006 · research only",
    accuracy: "Held-out accuracy",
    macro: "Held-out macro-F1",
    weighted: "Held-out weighted-F1",
    caseSplit: "Patient/case-disjoint evidence",
    external: "External validation",
    calibration: "Accepted release calibration",
    onnx: "Accepted ONNX release artifact",
    yes: "Yes",
    no: "No",
    decision: "Promotion decision",
    retain: "Retain EXP-005",
    eligible: "Eligible only for separate owner review",
    export: "Export comparison JSON",
    boundary: "No automatic model promotion. The comparison is research governance evidence, not a clinical ranking.",
  },
  hi: {
    eyebrow: "Experiment Arena",
    title: "Model promote करने से पहले evidence compare करें",
    intro: "EXP-005 और EXP-006 को declared held-out evidence और release gates पर compare किया जाता है। नया model या बेहतर validation score अपने-आप deployed research model को replace नहीं करता।",
    metric: "Evidence dimension",
    incumbent: "EXP-005 · active Mode A",
    candidate: "EXP-006 · research only",
    accuracy: "Held-out accuracy",
    macro: "Held-out macro-F1",
    weighted: "Held-out weighted-F1",
    caseSplit: "Patient/case-disjoint evidence",
    external: "External validation",
    calibration: "Accepted release calibration",
    onnx: "Accepted ONNX release artifact",
    yes: "हाँ",
    no: "नहीं",
    decision: "Promotion decision",
    retain: "EXP-005 retain करें",
    eligible: "केवल separate owner review के लिए eligible",
    export: "Comparison JSON export करें",
    boundary: "Automatic model promotion नहीं होता। यह comparison research governance evidence है, clinical ranking नहीं।",
  },
} as const;

function downloadComparison() {
  const blob = new Blob([JSON.stringify(exportExperimentComparison(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "neuroinsight-experiment-comparison.json";
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ExperimentArena() {
  const { language } = useLanguage();
  const text = copy[language];
  const incumbent = experimentComparisonRecords[0];
  const candidate = experimentComparisonRecords[1];
  const review = currentExperimentPromotionReview();
  const booleanValue = (value: boolean) => value ? text.yes : text.no;

  const rows: Array<[string, string, string]> = [
    [text.accuracy, incumbent.heldOutAccuracy.toFixed(4), candidate.heldOutAccuracy.toFixed(4)],
    [text.macro, incumbent.heldOutMacroF1.toFixed(4), candidate.heldOutMacroF1.toFixed(4)],
    [text.weighted, incumbent.heldOutWeightedF1.toFixed(4), candidate.heldOutWeightedF1.toFixed(4)],
    [text.caseSplit, booleanValue(incumbent.patientCaseDisjoint), booleanValue(candidate.patientCaseDisjoint)],
    [text.external, booleanValue(incumbent.externalValidation), booleanValue(candidate.externalValidation)],
    [text.calibration, booleanValue(incumbent.calibratedForRelease), booleanValue(candidate.calibratedForRelease)],
    [text.onnx, booleanValue(incumbent.onnxReleaseArtifact), booleanValue(candidate.onnxReleaseArtifact)],
  ];

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-[radial-gradient(circle_at_top_right,_rgba(20,184,166,0.18),_transparent_36%),linear-gradient(135deg,_#071c24,_#0d3a3d)] p-6 text-white sm:p-8">
        <div className="flex items-center gap-2 text-teal-200"><FlaskConical className="size-5" /><p className="text-xs font-semibold uppercase tracking-[0.15em]">{text.eyebrow}</p></div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">{text.title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">{text.intro}</p>
      </div>

      <div className="space-y-5 p-6 sm:p-8">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.08em] text-slate-600">
              <tr><th className="px-4 py-3">{text.metric}</th><th className="px-4 py-3">{text.incumbent}</th><th className="px-4 py-3">{text.candidate}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map(([label, left, right]) => <tr key={label}><th scope="row" className="px-4 py-3 text-left font-medium text-slate-800">{label}</th><td className="px-4 py-3 text-slate-700">{left}</td><td className="px-4 py-3 text-slate-700">{right}</td></tr>)}
            </tbody>
          </table>
        </div>

        <div className={`rounded-2xl border p-5 ${review.recommendation === "retain_incumbent" ? "border-teal-200 bg-teal-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex gap-3">
            {review.recommendation === "retain_incumbent" ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-800" /> : <ShieldX className="mt-0.5 size-5 shrink-0 text-amber-800" />}
            <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">{text.decision}</p><h3 className="mt-1 font-semibold text-slate-950">{review.recommendation === "retain_incumbent" ? text.retain : text.eligible}</h3><ul className="mt-3 space-y-1 text-sm leading-6 text-slate-700">{review.reasons.map(reason => <li key={reason}>• {reason}</li>)}</ul></div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-xs leading-5 text-slate-500">{text.boundary}</p>
          <button type="button" onClick={downloadComparison} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"><Download className="size-4" />{text.export}</button>
        </div>
      </div>
    </section>
  );
}
