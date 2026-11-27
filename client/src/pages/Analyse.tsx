import {
  ArrowRight,
  CheckCircle2,
  FileWarning,
  LoaderCircle,
  LockKeyhole,
  ScanSearch,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  UploadDropzone,
  type LocalFileCheck,
} from "@/components/UploadDropzone";
import {
  useAnalysis,
  type ClientAnalysisState,
} from "@/contexts/AnalysisContext";
import { copyFor } from "@/contexts/pageCopy";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  validateWithInferenceService,
  type InferenceAnalysisResponse,
} from "@/lib/inferenceApi";
import { sha256File } from "@/lib/researchPassport";

const analysisStatus = {
  complete: "ready",
  low_confidence: "low_confidence",
  incompatible: "incompatible",
  unavailable: "unavailable",
  partial: "unavailable",
} as const satisfies Record<
  InferenceAnalysisResponse["status"],
  ClientAnalysisState["status"]
>;

export default function Analyse() {
  const { language } = useLanguage();
  const text = copyFor(language).analyse;
  const hindi = language === "hi";
  const [acknowledged, setAcknowledged] = useState(false);
  const [selection, setSelection] = useState<{
    file: File;
    check: LocalFileCheck;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const activeRequest = useRef<string | null>(null);
  const { setCurrent } = useAnalysis();
  const [, navigate] = useLocation();

  useEffect(
    () => () => {
      activeRequest.current = null;
    },
    []
  );

  async function startAnalysis() {
    if (
      !acknowledged ||
      !selection?.check.valid ||
      checking ||
      activeRequest.current
    )
      return;
    const { file, check } = selection;
    const requestId = crypto.randomUUID();
    activeRequest.current = requestId;
    setProcessing(true);
    setServiceError(null);

    try {
      const [result, inputSha256] = await Promise.all([
        validateWithInferenceService(file, "classification", requestId),
        sha256File(file),
      ]);
      if (activeRequest.current !== requestId) return;
      if (!result.ok) {
        setServiceError(result.message);
        return;
      }

      const server = result.response;
      setCurrent({
        scanId: server.scan_id,
        mode: server.mode,
        fileName: file.name,
        fileSize: file.size,
        sourceFile: file,
        inputSha256,
        previewUrl: check.previewUrl ? URL.createObjectURL(file) : undefined,
        status: analysisStatus[server.status],
        modelVersion: server.model_version,
        predictedClass: server.predicted_class,
        modelConfidenceScore: server.model_confidence_score,
        calibrated: server.calibrated,
        uncertaintyReason: server.uncertainty_reason,
        gradCamDataUrl: server.grad_cam_png_base64
          ? `data:image/png;base64,${server.grad_cam_png_base64}`
          : null,
        serverResponse: server,
        messages: [
          text.validationPassed,
          ...check.warnings,
          ...server.warnings,
          ...server.limitations,
          server.uncertainty_reason ?? "",
          server.manual_review_recommended ? text.review : "",
        ].filter(Boolean),
        createdAt: new Date().toISOString(),
      });
      navigate("/results");
    } catch {
      if (activeRequest.current === requestId) {
        setServiceError(
          hindi
            ? "विश्लेषण पूरा नहीं हुआ। फिर से प्रयास करें।"
            : "The analysis could not be completed. Try again."
        );
      }
    } finally {
      if (activeRequest.current === requestId) {
        activeRequest.current = null;
        setProcessing(false);
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="workspace-hero rounded-3xl p-6 sm:p-9">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {text.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          {hindi
            ? "शोध के लिए एक 2D PNG या JPEG स्लाइस चुनें।"
            : "Choose one PNG or JPEG slice for research analysis."}
        </p>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section className="workspace-panel p-5">
          <h2 className="font-semibold">
            {hindi ? "डेटा उपयोग की पुष्टि" : "Confirm data use"}
          </h2>
          <label className="mt-3 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={processing || checking}
              onChange={event => {
                setAcknowledged(event.target.checked);
                setSelection(null);
                setServiceError(null);
              }}
              className="mt-1 size-4 shrink-0 accent-blue-800"
            />
            <span>{text.dataUseLabel}</span>
          </label>
        </section>

        <section className="min-w-0 space-y-4 workspace-panel p-5">
          <h2 className="font-semibold">
            {hindi ? "शोध छवि" : "Research image"}
          </h2>
          {acknowledged ? (
            <UploadDropzone
              mode="classification"
              disabled={processing}
              onCheckingChange={value => {
                setChecking(value);
                if (value) {
                  setSelection(null);
                  setServiceError(null);
                }
              }}
              onSelect={(file, check) => setSelection({ file, check })}
            />
          ) : (
            <div className="grid min-h-36 place-content-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-600">
              <LockKeyhole className="mx-auto size-5" aria-hidden="true" />
              <p>{text.unlockUpload}</p>
            </div>
          )}

          <div aria-live="polite">
            {selection && (
              <div
                className={`flex items-start gap-3 rounded-2xl border p-4 ${selection.check.valid ? "border-blue-200 bg-blue-50" : "border-rose-200 bg-rose-50"}`}
              >
                {selection.check.previewUrl ? (
                  <img
                    src={selection.check.previewUrl}
                    alt={copyFor(language).results.preview}
                    className="size-16 shrink-0 rounded-lg bg-slate-950 object-contain sm:size-20"
                  />
                ) : selection.check.valid ? (
                  <CheckCircle2
                    className="size-5 shrink-0 text-blue-800"
                    aria-hidden="true"
                  />
                ) : (
                  <FileWarning
                    className="size-5 shrink-0 text-rose-800"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0">
                  <h3 className="break-all font-semibold">
                    {selection.file.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {(selection.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {selection.check.messages.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-900">
                      {selection.check.messages.map(message => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-blue-900">
                      {hindi ? "फ़ाइल तैयार है।" : "File ready for analysis."}
                    </p>
                  )}
                  {selection.check.warnings.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                      {selection.check.warnings.map(warning => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {serviceError && (
            <div
              className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900"
              role="alert"
            >
              <h3 className="font-semibold">{text.validationFailed}</h3>
              <p className="mt-1 text-sm leading-6">{serviceError}</p>
            </div>
          )}

          <div
            className="flex justify-end border-t border-slate-100 pt-4"
            aria-live="polite"
          >
            <button
              type="button"
              onClick={startAnalysis}
              disabled={
                !acknowledged ||
                !selection?.check.valid ||
                checking ||
                processing
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-800 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-600 max-sm:w-full"
            >
              {processing ? (
                <>
                  <LoaderCircle
                    className="size-4 motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                  {text.validating}
                </>
              ) : (
                <>
                  <ScanSearch className="size-4" aria-hidden="true" />
                  {text.proceed}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
