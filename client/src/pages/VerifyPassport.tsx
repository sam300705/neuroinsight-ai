import {
  CheckCircle2,
  FileJson2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  SearchCheck,
  ShieldCheck,
  ShieldX,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { AcademicDisclaimer } from "@/components/ResearchDisclaimers";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  parseResearchPassportText,
  passportIntegritySummary,
  verifyPassportSourceFile,
  type VerifiedResearchPassport,
} from "@/lib/passportVerifier";

const copy = {
  en: {
    eyebrow: "Local Evidence Verifier",
    title: "Verify a Research Passport without re-uploading the source image",
    intro:
      "Load a NeuroInsight Research Passport JSON locally, then optionally select the original research image. The browser recomputes SHA-256 and compares it to the exported fingerprint. Neither file is sent to NeuroInsight by this verifier.",
    passport: "Research Passport JSON",
    choosePassport: "Choose passport",
    source: "Original research image",
    chooseSource: "Choose source image",
    sourceHelp: "Optional. Used only for local byte-for-byte fingerprint comparison.",
    schema: "Passport schema",
    fingerprint: "Source fingerprint",
    receipt: "Server receipt evidence",
    repeatability: "Repeatability evidence",
    recognized: "Recognized v1",
    awaiting: "Awaiting source file",
    match: "Exact SHA-256 match",
    mismatch: "SHA-256 mismatch",
    present: "Receipt was present at export",
    absent: "No receipt recorded",
    notVerified: "Not cryptographically verified here",
    repeatPassed: "Recorded as passed",
    repeatFailed: "Recorded as not passed",
    repeatMissing: "Not recorded",
    details: "Passport evidence",
    generated: "Generated",
    scan: "Scan UUID",
    request: "Request ID",
    model: "Model version",
    status: "Analysis status",
    scope: "Declared scope",
    prediction: "Experimental class",
    score: "Model score",
    reset: "Clear verifier",
    privacyTitle: "Local-by-design verification",
    privacy:
      "This page performs JSON parsing and SHA-256 comparison in your browser. It does not call the inference API. Clearing or leaving the page removes the selected verifier state.",
    cryptoTitle: "What this verifier does not prove",
    crypto:
      "A source hash match proves only that the selected bytes match the fingerprint stored in the passport. It does not validate the server HMAC receipt, prove authorship, establish clinical validity, or prove that the original source was lawful or de-identified.",
    invalid: "Passport verification failed",
    readError: "The passport could not be read locally.",
    tooLarge: "The passport exceeds the 512 KB local verification limit.",
    nonClaims: "Explicit non-claims carried by this passport",
  },
  hi: {
    eyebrow: "Local Evidence Verifier",
    title: "Source image दोबारा upload किए बिना Research Passport verify करें",
    intro:
      "NeuroInsight Research Passport JSON को locally load करें और चाहें तो original research image चुनें। Browser SHA-256 दोबारा compute करके exported fingerprint से compare करता है। Verifier दोनों files को NeuroInsight पर नहीं भेजता।",
    passport: "Research Passport JSON",
    choosePassport: "Passport चुनें",
    source: "Original research image",
    chooseSource: "Source image चुनें",
    sourceHelp: "Optional. केवल local byte-for-byte fingerprint comparison के लिए।",
    schema: "Passport schema",
    fingerprint: "Source fingerprint",
    receipt: "Server receipt evidence",
    repeatability: "Repeatability evidence",
    recognized: "Recognized v1",
    awaiting: "Source file का इंतज़ार",
    match: "Exact SHA-256 match",
    mismatch: "SHA-256 mismatch",
    present: "Export के समय receipt मौजूद था",
    absent: "Receipt record नहीं हुआ",
    notVerified: "यहाँ cryptographically verify नहीं हुआ",
    repeatPassed: "Passed के रूप में recorded",
    repeatFailed: "Not passed के रूप में recorded",
    repeatMissing: "Record नहीं हुआ",
    details: "Passport evidence",
    generated: "Generated",
    scan: "Scan UUID",
    request: "Request ID",
    model: "Model version",
    status: "Analysis status",
    scope: "Declared scope",
    prediction: "Experimental class",
    score: "Model score",
    reset: "Verifier clear करें",
    privacyTitle: "Local-by-design verification",
    privacy:
      "यह page JSON parsing और SHA-256 comparison browser में करता है। Inference API call नहीं होती। Page clear या leave करने पर verifier की selected state हट जाती है।",
    cryptoTitle: "यह verifier क्या prove नहीं करता",
    crypto:
      "Source hash match केवल यह prove करता है कि selected bytes passport में stored fingerprint से match करते हैं। यह server HMAC receipt, authorship, clinical validity, या source की lawful/de-identified स्थिति verify नहीं करता।",
    invalid: "Passport verification failed",
    readError: "Passport को locally read नहीं किया जा सका।",
    tooLarge: "Passport 512 KB local verification limit से बड़ा है।",
    nonClaims: "इस passport के explicit non-claims",
  },
} as const;

type SourceVerification =
  | { state: "idle" }
  | { state: "match"; actual: string; expected: string }
  | { state: "mismatch"; actual: string; expected: string }
  | { state: "error"; message: string };

export default function VerifyPassport() {
  const { language } = useLanguage();
  const text = copy[language];
  const [passport, setPassport] = useState<VerifiedResearchPassport | null>(null);
  const [passportName, setPassportName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceVerification, setSourceVerification] = useState<SourceVerification>({ state: "idle" });
  const summary = passport ? passportIntegritySummary(passport) : null;

  const loadPassport = async (file?: File) => {
    if (!file) return;
    setError(null);
    setPassport(null);
    setPassportName(null);
    setSourceVerification({ state: "idle" });
    if (file.size > 512 * 1024) {
      setError(text.tooLarge);
      return;
    }
    try {
      const parsed = parseResearchPassportText(await file.text());
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      setPassport(parsed.passport);
      setPassportName(file.name);
    } catch {
      setError(text.readError);
    }
  };

  const verifySource = async (file?: File) => {
    if (!file || !passport) return;
    const result = await verifyPassportSourceFile(passport, file);
    if (!result.ok) {
      setSourceVerification({ state: "error", message: result.message });
      return;
    }
    setSourceVerification({
      state: result.match ? "match" : "mismatch",
      actual: result.actualSha256,
      expected: result.expectedSha256,
    });
  };

  const clear = () => {
    setPassport(null);
    setPassportName(null);
    setError(null);
    setSourceVerification({ state: "idle" });
  };

  const repeatabilityLabel = !passport?.evidence.same_input_repeatability
    ? text.repeatMissing
    : passport.evidence.same_input_repeatability.passed
      ? text.repeatPassed
      : text.repeatFailed;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.2),_transparent_35%),linear-gradient(135deg,_#081f2c,_#0c3b3a)] p-7 text-white shadow-xl sm:p-10">
        <div className="flex items-center gap-2 text-teal-200"><SearchCheck className="size-5" /><p className="text-xs font-semibold uppercase tracking-[0.17em]">{text.eyebrow}</p></div>
        <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl">{text.title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">{text.intro}</p>
      </section>

      <AcademicDisclaimer />

      <section className="grid gap-4 lg:grid-cols-2">
        <label className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-teal-300">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-800"><FileJson2 className="size-5" /></span><div><h2 className="font-semibold">{text.passport}</h2><p className="mt-1 text-xs text-slate-500">neuroinsight-research-passport/v1 · JSON · max 512 KB</p></div></div>
          <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white"><Upload className="size-4" />{text.choosePassport}</span>
          <input className="sr-only" type="file" accept="application/json,.json" onChange={event => void loadPassport(event.target.files?.[0])} />
          {passportName ? <p className="mt-3 break-all text-xs text-teal-800"><CheckCircle2 className="mr-1 inline size-4" />{passportName}</p> : null}
        </label>

        <label className={`rounded-2xl border bg-white p-6 shadow-sm transition ${passport ? "border-slate-200 hover:border-teal-300" : "cursor-not-allowed border-slate-200 opacity-60"}`}>
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><Fingerprint className="size-5" /></span><div><h2 className="font-semibold">{text.source}</h2><p className="mt-1 text-xs text-slate-500">{text.sourceHelp}</p></div></div>
          <span className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"><Fingerprint className="size-4" />{text.chooseSource}</span>
          <input className="sr-only" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" disabled={!passport} onChange={event => void verifySource(event.target.files?.[0])} />
        </label>
      </section>

      {error ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-950" role="alert"><div className="flex gap-3"><ShieldX className="mt-0.5 size-5 shrink-0" /><div><h2 className="font-semibold">{text.invalid}</h2><p className="mt-1 text-sm leading-6">{error}</p></div></div></section> : null}

      {passport && summary ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatusCard icon={<ShieldCheck className="size-5" />} label={text.schema} value={text.recognized} tone="good" />
            <StatusCard
              icon={sourceVerification.state === "match" ? <ShieldCheck className="size-5" /> : sourceVerification.state === "mismatch" ? <ShieldX className="size-5" /> : <Fingerprint className="size-5" />}
              label={text.fingerprint}
              value={sourceVerification.state === "match" ? text.match : sourceVerification.state === "mismatch" ? text.mismatch : sourceVerification.state === "error" ? sourceVerification.message : text.awaiting}
              tone={sourceVerification.state === "match" ? "good" : sourceVerification.state === "mismatch" || sourceVerification.state === "error" ? "bad" : "neutral"}
            />
            <StatusCard icon={<KeyRound className="size-5" />} label={text.receipt} value={`${summary.serverReceiptWasAvailable ? text.present : text.absent} · ${text.notVerified}`} tone="neutral" />
            <StatusCard icon={<SearchCheck className="size-5" />} label={text.repeatability} value={repeatabilityLabel} tone={summary.repeatabilityPassed === true ? "good" : summary.repeatabilityPassed === false ? "bad" : "neutral"} />
          </section>

          {sourceVerification.state === "match" || sourceVerification.state === "mismatch" ? (
            <section className={`rounded-2xl border p-5 ${sourceVerification.state === "match" ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`} aria-live="polite">
              <div className="flex gap-3">{sourceVerification.state === "match" ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" /> : <ShieldX className="mt-0.5 size-5 shrink-0 text-rose-700" />}<div className="min-w-0"><h2 className="font-semibold">{sourceVerification.state === "match" ? text.match : text.mismatch}</h2><p className="mt-2 break-all font-mono text-[11px] leading-5">expected: {sourceVerification.expected}</p><p className="break-all font-mono text-[11px] leading-5">actual:&nbsp;&nbsp; {sourceVerification.actual}</p></div></div>
            </section>
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">{text.details}</p><h2 className="mt-2 text-xl font-semibold">{passport.input.file_name}</h2></div><button type="button" onClick={clear} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{text.reset}</button></div>
            <dl className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Detail label={text.generated} value={passport.generated_at} />
              <Detail label={text.scan} value={passport.analysis.scan_id} />
              <Detail label={text.request} value={passport.analysis.request_id} />
              <Detail label={text.model} value={passport.analysis.model_version} />
              <Detail label={text.status} value={passport.analysis.status} />
              <Detail label={text.scope} value={passport.scope} />
              <Detail label={text.prediction} value={passport.analysis.predicted_class ?? "Unavailable"} />
              <Detail label={text.score} value={passport.analysis.model_confidence_score === null ? "Unavailable" : `${(passport.analysis.model_confidence_score * 100).toFixed(2)}%`} />
            </dl>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-teal-200 bg-teal-50 p-5 text-teal-950"><div className="flex gap-3"><LockKeyhole className="mt-0.5 size-5 shrink-0" /><div><h2 className="font-semibold">{text.privacyTitle}</h2><p className="mt-2 text-sm leading-6">{text.privacy}</p></div></div></article>
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><div className="flex gap-3"><KeyRound className="mt-0.5 size-5 shrink-0" /><div><h2 className="font-semibold">{text.cryptoTitle}</h2><p className="mt-2 text-sm leading-6">{text.crypto}</p></div></div></article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-semibold">{text.nonClaims}</h2><ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">{passport.explicit_non_claims.map(item => <li key={item} className="flex gap-2"><ShieldX className="mt-1 size-4 shrink-0 text-slate-400" />{item}</li>)}</ul></section>
        </>
      ) : null}
    </div>
  );
}

function StatusCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "good" | "bad" | "neutral" }) {
  const classes = tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : tone === "bad" ? "border-rose-200 bg-rose-50 text-rose-950" : "border-slate-200 bg-white text-slate-900";
  return <article className={`rounded-2xl border p-5 shadow-sm ${classes}`}><div className="flex items-start gap-3"><span className="shrink-0">{icon}</span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.1em] opacity-65">{label}</p><p className="mt-2 break-words text-sm font-semibold leading-5">{value}</p></div></div></article>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</dt><dd className="mt-2 break-all text-sm font-medium text-slate-800">{value}</dd></div>;
}
