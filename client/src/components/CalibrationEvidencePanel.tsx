import { ChartNoAxesCombined, Gauge, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { InferenceAnalysisResponse } from "@/lib/inferenceApi";
import { validationEvidenceFor } from "@/lib/researchPassport";

const copy = {
  en: {
    eyebrow: "EXP-005 validation evidence",
    title: "Calibration boundary, not a medical probability",
    intro:
      "This visual uses the audited validation-only calibration record. It helps explain the software decision boundary without upgrading the score into clinical evidence.",
    score: "Current model score",
    threshold: "Abstention threshold",
    margin: "Distance from threshold",
    ece: "Validation ECE",
    brier: "Validation Brier score",
    coverage: "Validation coverage",
    accepted: "Accepted-sample accuracy",
    before: "before",
    after: "after",
    unavailable: "Audited calibration evidence is unavailable for this result.",
    caveat:
      "Same released dataset, image-level validation only. No patient-level, external, prospective, or clinical calibration claim.",
  },
  hi: {
    eyebrow: "EXP-005 validation evidence",
    title: "Calibration boundary — medical probability नहीं",
    intro:
      "यह visual audited validation-only calibration record दिखाता है। इसका उद्देश्य software decision boundary समझाना है, score को clinical evidence बनाना नहीं।",
    score: "Current model score",
    threshold: "Abstention threshold",
    margin: "Threshold से दूरी",
    ece: "Validation ECE",
    brier: "Validation Brier score",
    coverage: "Validation coverage",
    accepted: "Accepted-sample accuracy",
    before: "पहले",
    after: "बाद में",
    unavailable: "इस result के लिए audited calibration evidence उपलब्ध नहीं है।",
    caveat:
      "उसी released dataset पर image-level validation only. Patient-level, external, prospective या clinical calibration claim नहीं है।",
  },
} as const;

export function CalibrationEvidencePanel({ analysis }: { analysis: InferenceAnalysisResponse }) {
  const { language } = useLanguage();
  const text = copy[language];
  const evidence = validationEvidenceFor(analysis);
  const confidence = typeof analysis.model_confidence_score === "number"
    ? analysis.model_confidence_score
    : null;

  if (!evidence || confidence === null) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
        <div className="flex gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0" /><p className="text-sm leading-6">{text.unavailable}</p></div>
      </section>
    );
  }

  const scorePercent = Math.min(100, Math.max(0, confidence * 100));
  const thresholdPercent = evidence.abstentionThreshold * 100;
  const margin = (confidence - evidence.abstentionThreshold) * 100;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-teal-700">
            <Gauge className="size-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">{text.eyebrow}</p>
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{text.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{text.intro}</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${analysis.status === "low_confidence" ? "bg-amber-100 text-amber-900" : "bg-teal-100 text-teal-900"}`}>
          {analysis.status === "low_confidence" ? "ABSTAIN" : "ABOVE THRESHOLD"}
        </span>
      </div>

      <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-xs uppercase tracking-[0.12em] text-slate-400">{text.score}</p><p className="mt-1 text-3xl font-semibold">{scorePercent.toFixed(1)}%</p></div>
          <div className="text-right"><p className="text-xs uppercase tracking-[0.12em] text-slate-400">{text.margin}</p><p className={`mt-1 text-lg font-semibold ${margin >= 0 ? "text-teal-300" : "text-amber-300"}`}>{margin >= 0 ? "+" : ""}{margin.toFixed(1)} pp</p></div>
        </div>
        <div className="relative mt-5 h-3 overflow-visible rounded-full bg-slate-700" aria-label={`${text.score}: ${scorePercent.toFixed(1)}%; ${text.threshold}: ${thresholdPercent.toFixed(0)}%`}>
          <div className="h-3 rounded-full bg-teal-400" style={{ width: `${scorePercent}%` }} />
          <div className="absolute -top-2 h-7 w-0.5 bg-amber-300" style={{ left: `${thresholdPercent}%` }} />
          <span className="absolute top-6 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-amber-200" style={{ left: `${thresholdPercent}%` }}>{text.threshold} {thresholdPercent.toFixed(0)}%</span>
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={text.ece} value={`${(evidence.eceBefore * 100).toFixed(2)}% → ${(evidence.eceAfter * 100).toFixed(2)}%`} detail={`${text.before} → ${text.after}`} />
        <Metric label={text.brier} value={`${evidence.brierBefore.toFixed(3)} → ${evidence.brierAfter.toFixed(3)}`} detail={`${text.before} → ${text.after}`} />
        <Metric label={text.coverage} value={`${(evidence.validationCoverage * 100).toFixed(2)}%`} />
        <Metric label={text.accepted} value={`${(evidence.acceptedSampleAccuracy * 100).toFixed(2)}%`} />
      </div>

      <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <ChartNoAxesCombined className="mt-0.5 size-5 shrink-0" />
        <p>{text.caveat}</p>
      </div>
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}
