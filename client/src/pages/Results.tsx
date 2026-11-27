import {
  AlertTriangle,
  ArrowRight,
  ImageOff,
  LoaderCircle,
  Save,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { V32Result, findingLabel } from "@/components/V32Result";
import { v32FindingSummarySchema } from "@shared/v32Finding";
import { ChatPanel } from "@/components/ChatPanel";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { GradCamOverlay } from "@/components/GradCamOverlay";
import { copyFor } from "@/contexts/pageCopy";
import { useLanguage } from "@/contexts/LanguageContext";
import { generateResearchReport } from "@/lib/inferenceApi";
import { trpc } from "@/lib/trpc";
import { loginConfigured, startLogin } from "@/const";

const classLabel: Record<string, string> = {
  glioma: "Glioma",
  meningioma: "Meningioma",
  pituitary: "Pituitary tumor",
  no_tumor: "No tumor",
};

export default function Results() {
  const { language } = useLanguage();
  const text = copyFor(language).results;
  const { current } = useAnalysis();
  const auth = useAuth();
  const utils = trpc.useUtils();
  const saveResult = trpc.scans.saveResult.useMutation();
  const registerArtifact = trpc.scans.registerArtifact.useMutation();
  const [persistenceState, setPersistenceState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(
    null
  );
  const hindi = language === "hi";

  if (!current)
    return (
      <section className="workspace-panel mx-auto max-w-xl px-6 py-12 text-center">
        <ImageOff className="mx-auto size-8 text-blue-700" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          {text.emptyTitle}
        </h1>
        <Link
          href="/analyse"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          {text.analyse}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    );

  const realClassification =
    current.mode === "classification" &&
    Boolean(
      current.predictedClass && typeof current.modelConfidenceScore === "number"
    );
  const finding = current.serverResponse?.finding;
  const lowConfidence = current.status === "low_confidence";
  const canPersist =
    current.mode === "classification" &&
    Boolean(current.serverResponse && realClassification);
  const canPersistDerivedArtifacts =
    canPersist && Boolean(current.serverResponse?.analysis_receipt);
  const persistDerivedArtifacts = async () => {
    if (!current.serverResponse || !canPersist) return;
    if (!auth.isAuthenticated) {
      startLogin();
      return;
    }
    setPersistenceState("saving");
    setPersistenceMessage(null);
    const response = current.serverResponse;
    try {
      await saveResult.mutateAsync({
        scanId: response.scan_id,
        mode: "classification",
        status: response.status,
        modelVersion: response.model_version,
        processingTimeMs: response.processing_time_ms,
        predictedClass: response.predicted_class ?? undefined,
        confidenceScore: response.model_confidence_score ?? undefined,
        calibrated: Boolean(response.calibrated),
        uncertaintyReason: response.uncertainty_reason ?? undefined,
        manualReviewRecommended: response.manual_review_recommended,
        measurement: {
          kind: response.measurement.kind,
          pixelCount: response.measurement.pixel_count ?? undefined,
          voxelCount: response.measurement.voxel_count ?? undefined,
          occupancyPercent: response.measurement.occupancy_percent ?? undefined,
          value: response.measurement.value ?? undefined,
          unit: response.measurement.unit ?? undefined,
          metadataConfirmed: response.measurement.metadata_confirmed,
          limitation: response.measurement.limitation,
          finding: response.finding
            ? v32FindingSummarySchema.parse(response.finding)
            : undefined,
        },
        warnings: [...response.warnings, ...response.limitations],
      });
      const report = await generateResearchReport(response);
      if (!report.ok) throw new Error(report.message);
      await registerArtifact.mutateAsync({
        scanId: response.scan_id,
        artifactType: "report",
        contentType: "application/pdf",
        fileName: `neuroinsight-${response.scan_id}.pdf`,
        base64: report.base64,
      });
      if (!response.finding && response.grad_cam_png_base64)
        await registerArtifact.mutateAsync({
          scanId: response.scan_id,
          artifactType: "grad_cam",
          contentType: "image/png",
          fileName: `neuroinsight-${response.scan_id}-grad-cam.png`,
          base64: response.grad_cam_png_base64,
        });
      await utils.scans.list.invalidate();
      setPersistenceState("saved");
      setPersistenceMessage(text.savedMessage);
    } catch {
      setPersistenceState("error");
      setPersistenceMessage(text.saveError);
    }
  };
  const needsReview = Boolean(
    lowConfidence ||
      finding?.needs_review ||
      current.serverResponse?.manual_review_recommended
  );
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="workspace-hero rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-sky-200">
              {hindi ? "शोध परिणाम" : "Research result"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {finding
                ? findingLabel(finding.final_label, language)
                : text.title}
            </h1>
          </div>
          {needsReview && (
            <span className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              {text.manual}
            </span>
          )}
        </div>
      </header>

      {finding && current.serverResponse ? (
        <V32Result
          key={current.scanId}
          analysis={{ ...current.serverResponse, finding }}
          previewUrl={current.previewUrl}
        />
      ) : (
        <>
          <section className="workspace-panel grid items-start gap-5 p-5 sm:grid-cols-2 sm:p-6">
            {current.previewUrl && (
              <img
                src={current.previewUrl}
                alt={text.preview}
                className="max-h-96 w-full rounded-xl bg-slate-950 object-contain"
              />
            )}
            <div>
              <h2 className="text-lg font-semibold">
                {realClassification
                  ? lowConfidence
                    ? text.reviewResult
                    : text.experimentalResult
                  : text.unavailable}
              </h2>
              {realClassification ? (
                <dl className="mt-4 space-y-4 text-sm">
                  <div>
                    <dt className="font-semibold">{text.prediction}</dt>
                    <dd>{classLabel[current.predictedClass!]}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">{text.confidence}</dt>
                    <dd>{(current.modelConfidenceScore! * 100).toFixed(1)}%</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {text.unavailableDetail}
                </p>
              )}
            </div>
          </section>
          {current.mode === "classification" && current.gradCamDataUrl && (
            <GradCamOverlay sourceUrl={current.gradCamDataUrl} />
          )}
        </>
      )}

      {canPersistDerivedArtifacts &&
        (auth.isAuthenticated || loginConfigured) && (
          <section className="workspace-panel p-5 sm:p-6" aria-live="polite">
            <h2 className="font-semibold">
              {hindi ? "शोध रिपोर्ट" : "Research report"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {hindi
                ? "PDF को अपने सुरक्षित इतिहास में सहेजें।"
                : "Save the PDF to your protected history."}
            </p>
            <button
              type="button"
              onClick={persistDerivedArtifacts}
              disabled={
                persistenceState === "saving" || persistenceState === "saved"
              }
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:bg-slate-600"
            >
              {persistenceState === "saving" ? (
                <>
                  <LoaderCircle
                    className="size-4 motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                  {text.saving}
                </>
              ) : (
                <>
                  <Save className="size-4" aria-hidden="true" />
                  {auth.isAuthenticated
                    ? persistenceState === "saved"
                      ? text.saved
                      : text.save
                    : text.signInSave}
                </>
              )}
            </button>
            {persistenceMessage && (
              <p
                className={`mt-3 text-sm ${persistenceState === "error" ? "text-rose-800" : "text-slate-700"}`}
                role={persistenceState === "error" ? "alert" : undefined}
              >
                {persistenceMessage}
              </p>
            )}
          </section>
        )}

      <details className="workspace-panel p-5">
        <summary className="cursor-pointer rounded text-sm font-semibold focus-visible:outline-2 focus-visible:outline-blue-700">
          {hindi ? "विश्लेषण विवरण" : "Analysis details"}
        </summary>
        <p className="mt-3 break-all text-sm text-slate-600">
          {text.scanId} <code>{current.scanId}</code>
        </p>
        {current.messages.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
            {current.messages.map(message => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
      </details>
      <details className="workspace-panel p-5">
        <summary className="cursor-pointer rounded text-sm font-semibold focus-visible:outline-2 focus-visible:outline-blue-700">
          {hindi ? "परिणाम के बारे में पूछें" : "Ask about the result"}
        </summary>
        <div className="mt-4">
          <ChatPanel />
        </div>
      </details>
    </div>
  );
}
