import type { AnalysisMode } from "@shared/neuroinsight";
import {
  validateWithInferenceService,
  type InferenceAnalysisResponse,
} from "@/lib/inferenceApi";

const REPEATABILITY_TOLERANCE = 1e-6;
const EXP005_MODEL_VERSION = "bdneuro-v7-resnet50-head-only-exp005";

export const EXP005_VALIDATION_EVIDENCE = Object.freeze({
  modelVersion: EXP005_MODEL_VERSION,
  evidenceScope: "same_dataset_image_level_validation_only" as const,
  temperature: 0.6899,
  eceBefore: 0.0885,
  eceAfter: 0.0251,
  brierBefore: 0.279,
  brierAfter: 0.266,
  abstentionThreshold: 0.55,
  validationCoverage: 0.8821,
  acceptedSampleAccuracy: 0.8535,
});

export type RepeatabilityOutcome = {
  requestId: string;
  status: InferenceAnalysisResponse["status"];
  predictedClass: InferenceAnalysisResponse["predicted_class"];
  confidence: number | null;
  calibrated: boolean;
};

export type RepeatabilityEvidence = {
  runs: number;
  stableClass: boolean;
  stableStatus: boolean;
  stableCalibration: boolean;
  confidenceSpread: number | null;
  tolerance: number;
  passed: boolean;
  outcomes: RepeatabilityOutcome[];
};

export type ResearchPassport = {
  schema_version: "neuroinsight-research-passport/v1";
  generated_at: string;
  scope: "academic_non_clinical_research";
  input: {
    file_name: string;
    file_size_bytes: number;
    sha256: string | null;
    retention: "memory_only_in_dashboard";
  };
  analysis: {
    request_id: string;
    scan_id: string;
    mode: AnalysisMode;
    status: InferenceAnalysisResponse["status"];
    model_version: string;
    predicted_class: InferenceAnalysisResponse["predicted_class"];
    model_confidence_score: number | null;
    calibrated: boolean;
    uncertainty_reason: string | null;
    manual_review_recommended: boolean;
    processing_time_ms: number;
    validation_abstention_threshold: number | null;
    threshold_margin: number | null;
  };
  evidence: {
    grad_cam_available: boolean;
    integrity_receipt_available: boolean;
    measurement_kind: InferenceAnalysisResponse["measurement"]["kind"];
    measurement_metadata_confirmed: boolean;
    same_input_repeatability: RepeatabilityEvidence | null;
    validation_calibration: typeof EXP005_VALIDATION_EVIDENCE | null;
  };
  explicit_non_claims: string[];
  warnings: string[];
  limitations: string[];
};

export async function sha256File(file: Blob): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const bytes = await file.arrayBuffer();
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

export function validationEvidenceFor(
  analysis: InferenceAnalysisResponse,
): typeof EXP005_VALIDATION_EVIDENCE | null {
  return analysis.model_version === EXP005_MODEL_VERSION && analysis.calibrated
    ? EXP005_VALIDATION_EVIDENCE
    : null;
}

export function evaluateRepeatability(
  responses: InferenceAnalysisResponse[],
): RepeatabilityEvidence {
  if (responses.length < 2) {
    throw new Error("Repeatability evidence requires at least two successful runs.");
  }

  const outcomes: RepeatabilityOutcome[] = responses.map(response => ({
    requestId: response.request_id,
    status: response.status,
    predictedClass: response.predicted_class,
    confidence:
      typeof response.model_confidence_score === "number"
        ? response.model_confidence_score
        : null,
    calibrated: Boolean(response.calibrated),
  }));

  const baseline = outcomes[0];
  const stableClass = outcomes.every(item => item.predictedClass === baseline.predictedClass);
  const stableStatus = outcomes.every(item => item.status === baseline.status);
  const stableCalibration = outcomes.every(item => item.calibrated === baseline.calibrated);
  const confidences = outcomes.map(item => item.confidence);
  const confidenceSpread = confidences.every(value => typeof value === "number")
    ? Math.max(...(confidences as number[])) - Math.min(...(confidences as number[]))
    : null;
  const passed =
    stableClass &&
    stableStatus &&
    stableCalibration &&
    confidenceSpread !== null &&
    confidenceSpread <= REPEATABILITY_TOLERANCE;

  return {
    runs: outcomes.length,
    stableClass,
    stableStatus,
    stableCalibration,
    confidenceSpread,
    tolerance: REPEATABILITY_TOLERANCE,
    passed,
    outcomes,
  };
}

export async function runSameInputRepeatability(
  file: File,
  fetchImpl: typeof fetch = fetch,
  runs = 3,
): Promise<{ ok: true; evidence: RepeatabilityEvidence } | { ok: false; message: string }> {
  if (!Number.isInteger(runs) || runs < 2 || runs > 4) {
    return { ok: false, message: "Repeatability checks support between two and four runs." };
  }

  const responses: InferenceAnalysisResponse[] = [];
  for (let index = 0; index < runs; index += 1) {
    const requestId = globalThis.crypto?.randomUUID?.() ?? `repeatability-${Date.now()}-${index}`;
    const result = await validateWithInferenceService(
      file,
      "classification",
      requestId,
      fetchImpl,
    );
    if (!result.ok) {
      return {
        ok: false,
        message: `Repeatability run ${index + 1} could not be verified: ${result.message}`,
      };
    }
    responses.push(result.response);
  }

  return { ok: true, evidence: evaluateRepeatability(responses) };
}

export function buildResearchPassport(input: {
  analysis: InferenceAnalysisResponse;
  fileName: string;
  fileSize: number;
  inputSha256?: string | null;
  repeatability?: RepeatabilityEvidence | null;
  generatedAt?: string;
}): ResearchPassport {
  const { analysis } = input;
  const validationCalibration = validationEvidenceFor(analysis);
  const confidence = typeof analysis.model_confidence_score === "number"
    ? analysis.model_confidence_score
    : null;
  const threshold = validationCalibration?.abstentionThreshold ?? null;
  return {
    schema_version: "neuroinsight-research-passport/v1",
    generated_at: input.generatedAt ?? new Date().toISOString(),
    scope: "academic_non_clinical_research",
    input: {
      file_name: input.fileName,
      file_size_bytes: input.fileSize,
      sha256: input.inputSha256 ?? null,
      retention: "memory_only_in_dashboard",
    },
    analysis: {
      request_id: analysis.request_id,
      scan_id: analysis.scan_id,
      mode: analysis.mode,
      status: analysis.status,
      model_version: analysis.model_version,
      predicted_class: analysis.predicted_class,
      model_confidence_score: confidence,
      calibrated: Boolean(analysis.calibrated),
      uncertainty_reason: analysis.uncertainty_reason ?? null,
      manual_review_recommended: analysis.manual_review_recommended,
      processing_time_ms: analysis.processing_time_ms,
      validation_abstention_threshold: threshold,
      threshold_margin: confidence !== null && threshold !== null ? confidence - threshold : null,
    },
    evidence: {
      grad_cam_available: Boolean(analysis.grad_cam_png_base64),
      integrity_receipt_available: Boolean(analysis.analysis_receipt),
      measurement_kind: analysis.measurement.kind,
      measurement_metadata_confirmed: analysis.measurement.metadata_confirmed,
      same_input_repeatability: input.repeatability ?? null,
      validation_calibration: validationCalibration,
    },
    explicit_non_claims: [
      "No clinical diagnosis or treatment recommendation is claimed.",
      "No external or prospective clinical validation is claimed.",
      "No out-of-distribution detector is currently validated for this classifier.",
      "No conformal coverage guarantee is currently claimed.",
      "No segmentation, tumor boundary, physical area, or volume is produced by Mode A.",
      "Grad-CAM is classifier attribution and must not be interpreted as a tumor boundary.",
    ],
    warnings: [...analysis.warnings],
    limitations: [...analysis.limitations],
  };
}
