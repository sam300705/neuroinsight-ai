import {
  BadgeCheck,
  Beaker,
  Download,
  Fingerprint,
  FlaskConical,
  LoaderCircle,
  Repeat2,
  ShieldCheck,
  ShieldX,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { InferenceAnalysisResponse } from "@/lib/inferenceApi";
import {
  buildResearchPassport,
  runSameInputRepeatability,
  type RepeatabilityEvidence,
} from "@/lib/researchPassport";

const copy = {
  en: {
    eyebrow: "Research Trust Lab",
    title: "Evidence before confidence",
    intro:
      "A reproducibility and transparency layer around this experimental result. It records what was verified, what can be repeated, and what the system still cannot claim.",
    fingerprint: "Input fingerprint",
    model: "Model provenance",
    calibration: "Calibration",
    abstention: "Selective prediction",
    attribution: "Attribution",
    receipt: "Integrity receipt",
    repeatability: "Same-input repeatability",
    available: "Available",
    unavailable: "Unavailable",
    calibrated: "Validation-only temperature scaling",
    notCalibrated: "Not recorded",
    triggered: "Abstention triggered",
    aboveThreshold: "Above validation-derived abstention threshold",
    gradcam: "Grad-CAM recorded",
    noGradcam: "No attribution artifact",
    signed: "Server receipt available",
    unsigned: "Signing not configured for this result",
    notRun: "Not run",
    passed: "Repeatable",
    drift: "Drift detected",
    run: "Run 3× repeatability check",
    running: "Running repeatability check…",
    repeatHelp:
      "Re-sends the same in-memory research image three times and compares class, status, calibration flag, and confidence. Nothing from this check is saved to history.",
    noSource:
      "The original in-memory file is no longer available, so a repeatability rerun cannot be performed.",
    gapsTitle: "Explicit evidence gaps",
    gapsIntro:
      "These are deliberately shown instead of being hidden behind a single confidence number.",
    ood: "Validated out-of-distribution detector",
    conformal: "Conformal coverage guarantee",
    external: "External / prospective clinical validation",
    segmentation: "Segmentation or physical volumetry",
    notEstablished: "Not established",
    notClaimed: "Not claimed",
    modeBUnavailable: "Unavailable in Mode A",
    exportTitle: "Reproducibility capsule",
    exportDetail:
      "Download a portable JSON passport containing identifiers, input hash, model/version evidence, uncertainty state, warnings, limitations, and repeatability evidence when available.",
    export: "Download research passport",
    spread: "Confidence spread",
    runs: "successful runs",
    nonClinical:
      "Research evidence only — this panel does not convert the classifier into a clinical diagnostic system.",
  },
  hi: {
    eyebrow: "रिसर्च ट्रस्ट लैब",
    title: "कॉन्फिडेंस से पहले एविडेंस",
    intro:
      "इस experimental result के चारों ओर reproducibility और transparency layer। यह बताती है कि क्या verify हुआ, क्या repeat किया जा सकता है और सिस्टम अभी क्या claim नहीं कर सकता।",
    fingerprint: "इनपुट फिंगरप्रिंट",
    model: "मॉडल provenance",
    calibration: "कैलिब्रेशन",
    abstention: "Selective prediction",
    attribution: "Attribution",
    receipt: "Integrity receipt",
    repeatability: "Same-input repeatability",
    available: "उपलब्ध",
    unavailable: "उपलब्ध नहीं",
    calibrated: "Validation-only temperature scaling",
    notCalibrated: "रिकॉर्ड नहीं",
    triggered: "Abstention trigger हुआ",
    aboveThreshold: "Validation-derived abstention threshold से ऊपर",
    gradcam: "Grad-CAM रिकॉर्ड हुआ",
    noGradcam: "Attribution artifact नहीं",
    signed: "Server receipt उपलब्ध",
    unsigned: "इस result के लिए signing configure नहीं है",
    notRun: "अभी नहीं चला",
    passed: "Repeatable",
    drift: "Drift मिला",
    run: "3× repeatability check चलाएँ",
    running: "Repeatability check चल रहा है…",
    repeatHelp:
      "उसी in-memory research image को तीन बार भेजकर class, status, calibration flag और confidence compare करता है। इस check को history में save नहीं किया जाता।",
    noSource:
      "Original in-memory file अब उपलब्ध नहीं है, इसलिए repeatability rerun नहीं चल सकता।",
    gapsTitle: "स्पष्ट evidence gaps",
    gapsIntro:
      "एक confidence number के पीछे इन्हें छिपाने के बजाय साफ़ दिखाया गया है।",
    ood: "Validated out-of-distribution detector",
    conformal: "Conformal coverage guarantee",
    external: "External / prospective clinical validation",
    segmentation: "Segmentation या physical volumetry",
    notEstablished: "स्थापित नहीं",
    notClaimed: "Claim नहीं किया गया",
    modeBUnavailable: "Mode A में उपलब्ध नहीं",
    exportTitle: "Reproducibility capsule",
    exportDetail:
      "Identifiers, input hash, model/version evidence, uncertainty state, warnings, limitations और repeatability evidence वाला portable JSON passport डाउनलोड करें।",
    export: "Research passport डाउनलोड करें",
    spread: "Confidence spread",
    runs: "successful runs",
    nonClinical:
      "केवल research evidence — यह panel classifier को clinical diagnostic system नहीं बनाता।",
  },
} as const;

type Props = {
  analysis: InferenceAnalysisResponse;
  fileName: string;
  fileSize: number;
  inputSha256?: string | null;
  sourceFile?: File;
};

function EvidenceCard({
  label,
  value,
  detail,
  positive = true,
}: {
  label: string;
  value: string;
  detail?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${positive ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-800"}`}
        >
          {positive ? <ShieldCheck className="size-4" /> : <ShieldX className="size-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
          {detail ? <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function ResearchTrustLab({
  analysis,
  fileName,
  fileSize,
  inputSha256,
  sourceFile,
}: Props) {
  const { language } = useLanguage();
  const text = copy[language];
  const [repeatability, setRepeatability] = useState<RepeatabilityEvidence | null>(null);
  const [repeatabilityState, setRepeatabilityState] = useState<"idle" | "running" | "error">("idle");
  const [repeatabilityError, setRepeatabilityError] = useState<string | null>(null);

  const fingerprint = inputSha256 ? `sha256:${inputSha256}` : text.unavailable;
  const repeatabilityValue = repeatability
    ? repeatability.passed
      ? text.passed
      : text.drift
    : text.notRun;

  const passport = useMemo(
    () =>
      buildResearchPassport({
        analysis,
        fileName,
        fileSize,
        inputSha256,
        repeatability,
      }),
    [analysis, fileName, fileSize, inputSha256, repeatability],
  );

  const runRepeatability = async () => {
    if (!sourceFile || repeatabilityState === "running") return;
    setRepeatabilityState("running");
    setRepeatabilityError(null);
    const result = await runSameInputRepeatability(sourceFile);
    if (!result.ok) {
      setRepeatabilityState("error");
      setRepeatabilityError(result.message);
      return;
    }
    setRepeatability(result.evidence);
    setRepeatabilityState("idle");
  };

  const downloadPassport = () => {
    const blob = new Blob([JSON.stringify(passport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `neuroinsight-${analysis.scan_id}-research-passport.json`;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-xl">
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(20,184,166,0.18),_transparent_42%)] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-teal-300">
              <FlaskConical className="size-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em]">{text.eyebrow}</p>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{text.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{text.intro}</p>
          </div>
          <div className="rounded-2xl border border-teal-400/20 bg-teal-400/10 px-4 py-3 text-xs leading-5 text-teal-100">
            <BadgeCheck className="mb-2 size-5 text-teal-300" />
            {text.nonClinical}
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <EvidenceCard
            label={text.fingerprint}
            value={fingerprint}
            detail={`${(fileSize / 1024 / 1024).toFixed(2)} MB · memory-only source`}
            positive={Boolean(inputSha256)}
          />
          <EvidenceCard label={text.model} value={analysis.model_version} detail={`request ${analysis.request_id}`} />
          <EvidenceCard
            label={text.calibration}
            value={analysis.calibrated ? text.calibrated : text.notCalibrated}
            positive={Boolean(analysis.calibrated)}
          />
          <EvidenceCard
            label={text.abstention}
            value={analysis.status === "low_confidence" ? text.triggered : text.aboveThreshold}
            positive={analysis.status !== "low_confidence"}
          />
          <EvidenceCard
            label={text.attribution}
            value={analysis.grad_cam_png_base64 ? text.gradcam : text.noGradcam}
            positive={Boolean(analysis.grad_cam_png_base64)}
          />
          <EvidenceCard
            label={text.receipt}
            value={analysis.analysis_receipt ? text.signed : text.unsigned}
            positive={Boolean(analysis.analysis_receipt)}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2">
              <Repeat2 className="size-5 text-teal-300" />
              <h3 className="font-semibold">{text.repeatability}</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{text.repeatHelp}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={runRepeatability}
                disabled={!sourceFile || repeatabilityState === "running"}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {repeatabilityState === "running" ? (
                  <><LoaderCircle className="size-4 animate-spin" />{text.running}</>
                ) : (
                  <><Beaker className="size-4" />{text.run}</>
                )}
              </button>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${repeatability?.passed ? "bg-emerald-400/15 text-emerald-200" : repeatability ? "bg-amber-400/15 text-amber-200" : "bg-white/10 text-slate-300"}`}
              >
                {repeatabilityValue}
              </span>
            </div>
            {!sourceFile ? <p className="mt-3 text-xs leading-5 text-amber-200">{text.noSource}</p> : null}
            {repeatabilityError ? <p className="mt-3 text-xs leading-5 text-rose-200" role="alert">{repeatabilityError}</p> : null}
            {repeatability ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-xs text-slate-400">{text.runs}</p>
                  <p className="mt-1 text-lg font-semibold">{repeatability.runs}</p>
                </div>
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-xs text-slate-400">{text.spread}</p>
                  <p className="mt-1 text-lg font-semibold">
                    {repeatability.confidenceSpread === null
                      ? text.unavailable
                      : repeatability.confidenceSpread.toExponential(2)}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2">
              <TriangleAlert className="size-5 text-amber-300" />
              <h3 className="font-semibold">{text.gapsTitle}</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{text.gapsIntro}</p>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                [text.ood, text.notEstablished],
                [text.conformal, text.notClaimed],
                [text.external, text.notEstablished],
                [text.segmentation, text.modeBUnavailable],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-white/10 pb-3 last:border-0 last:pb-0">
                  <dt className="text-slate-300">{label}</dt>
                  <dd className="shrink-0 font-semibold text-amber-200">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2">
                <Fingerprint className="size-5 text-teal-300" />
                <h3 className="font-semibold">{text.exportTitle}</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{text.exportDetail}</p>
            </div>
            <button
              type="button"
              onClick={downloadPassport}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
            >
              <Download className="size-4" />
              {text.export}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
