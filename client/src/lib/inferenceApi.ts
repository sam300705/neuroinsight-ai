import type { AnalysisMode } from "@shared/neuroinsight";
import { z } from "zod";

const ANALYZE_TIMEOUT_MS = 45_000;
const REPORT_TIMEOUT_MS = 30_000;
const CHAT_TIMEOUT_MS = 20_000;
const MAX_REPORT_BYTES = 15_000_000;

const measurementSchema = z.object({
  kind: z.enum(["unavailable", "relative_area", "physical_area", "physical_volume"]),
  pixel_count: z.number().int().nonnegative().nullable().optional(),
  voxel_count: z.number().int().nonnegative().nullable().optional(),
  occupancy_percent: z.number().min(0).max(100).nullable().optional(),
  value: z.number().nonnegative().nullable().optional(),
  unit: z.enum(["pixels", "voxels", "percent", "mm²", "mL"]).nullable().optional(),
  metadata_confirmed: z.boolean(),
  limitation: z.string().max(2_000),
}).strict();

const analysisResponseSchema = z.object({
  request_id: z.string().min(1).max(128),
  scan_id: z.string().uuid(),
  mode: z.enum(["classification", "segmentation"]),
  status: z.enum(["complete", "low_confidence", "unavailable", "incompatible", "partial"]),
  model_version: z.string().min(1).max(256),
  processing_time_ms: z.number().int().nonnegative(),
  manual_review_recommended: z.boolean(),
  predicted_class: z.enum(["glioma", "meningioma", "pituitary", "no_tumor"]).nullable().optional(),
  model_confidence_score: z.number().min(0).max(1).nullable().optional(),
  calibrated: z.boolean().optional(),
  uncertainty_reason: z.string().max(2_000).nullable().optional(),
  measurement: measurementSchema,
  grad_cam_url: z.string().max(2_048).nullable().optional(),
  grad_cam_png_base64: z.string().max(14_000_000).nullable().optional(),
  analysis_receipt: z.string().max(8_192).nullable().optional(),
  segmentation_mask_url: z.string().max(2_048).nullable().optional(),
  warnings: z.array(z.string().max(2_000)).max(100),
  limitations: z.array(z.string().max(2_000)).max(100),
}).strict();

const chatResponseSchema = z.object({
  answer: z.string().min(1).max(1_200),
  source: z.enum(["offline_faq", "openai", "gemini"]),
  category: z.enum(["model_explanation", "calibration", "abstention", "grad_cam", "mode_boundary", "methodology", "report", "general", "refusal"]),
  medical_advice_refused: z.boolean(),
  manual_review_reminder: z.boolean(),
  disclaimer_required: z.boolean(),
  safety_notice: z.string().min(1).max(1_200),
}).strict();

export type InferenceMeasurement = {
  kind: "unavailable" | "relative_area" | "physical_area" | "physical_volume";
  pixel_count?: number | null;
  voxel_count?: number | null;
  occupancy_percent?: number | null;
  value?: number | null;
  unit?: "pixels" | "voxels" | "percent" | "mm²" | "mL" | null;
  metadata_confirmed: boolean;
  limitation: string;
};

export type InferenceAnalysisResponse = {
  request_id: string;
  scan_id: string;
  mode: AnalysisMode;
  status: "complete" | "low_confidence" | "unavailable" | "incompatible" | "partial";
  model_version: string;
  processing_time_ms: number;
  manual_review_recommended: boolean;
  predicted_class?: "glioma" | "meningioma" | "pituitary" | "no_tumor" | null;
  model_confidence_score?: number | null;
  calibrated?: boolean;
  uncertainty_reason?: string | null;
  measurement: InferenceMeasurement;
  grad_cam_png_base64?: string | null;
  analysis_receipt?: string | null;
  warnings: string[];
  limitations: string[];
};

export type InferenceValidationResult =
  | { ok: true; response: InferenceAnalysisResponse }
  | { ok: false; message: string };

export type ResearchExplanationRequest = {
  question: string;
  language: "en" | "hi";
  purpose?: "question" | "result_summary";
  predicted_class?: InferenceAnalysisResponse["predicted_class"];
  model_version?: "bdneuro-v7-resnet50-head-only-exp005";
  model_confidence_score?: number | null;
  calibrated?: boolean;
  manual_review_recommended?: boolean;
  grad_cam_available?: boolean;
  uncertainty_reason?: string | null;
  measurement_available?: false;
};

export type ResearchExplanationResult =
  | { ok: true; answer: string; source: "offline_faq" | "openai" | "gemini"; category: string; medical_advice_refused: boolean; manual_review_reminder: boolean; disclaimer_required: boolean }
  | { ok: false; message: string };

function safeMessage(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && "detail" in value) {
    const detail = (value as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

function apiBaseUrl() {
  return import.meta.env.VITE_INFERENCE_API_BASE_URL?.replace(/\/$/, "") ?? "";
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

async function fetchWithTimeout(fetchImpl: typeof fetch, input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

export async function validateWithInferenceService(
  file: File,
  mode: AnalysisMode,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = ANALYZE_TIMEOUT_MS,
): Promise<InferenceValidationResult> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) {
    return {
      ok: false,
      message:
        "The independent server-side validation service is not configured in this dashboard environment. No scan was submitted and no model output has been generated.",
    };
  }

  const form = new FormData();
  form.set("mode", mode);
  form.set("file", file, file.name);

  try {
    const response = await fetchWithTimeout(fetchImpl, `${baseUrl}/api/v1/analyze`, {
      method: "POST",
      headers: { "x-request-id": requestId },
      body: form,
    }, timeoutMs);
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: safeMessage(payload, "The server-side validation service could not process this upload."),
      };
    }

    const candidate = analysisResponseSchema.safeParse(payload);
    if (!candidate.success) {
      return { ok: false, message: "The validation service returned an incomplete response. No model output is available." };
    }
    return { ok: true, response: candidate.data };
  } catch (error) {
    return {
      ok: false,
      message: isAbortError(error)
        ? "The server-side validation timed out. No model output has been accepted; please retry once."
        : "The server-side validation service could not be reached. No scan was submitted and no model output has been generated.",
    };
  }
}

export async function generateResearchReport(
  analysis: InferenceAnalysisResponse,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = REPORT_TIMEOUT_MS,
): Promise<{ ok: true; base64: string } | { ok: false; message: string }> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) return { ok: false, message: "The validation service is not configured, so no derived report can be generated." };
  if (!analysis.analysis_receipt) return { ok: false, message: "This result does not include a current server-issued report receipt, so a derived report cannot be generated." };

  try {
    const response = await fetchWithTimeout(fetchImpl, `${baseUrl}/api/v1/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysis_receipt: analysis.analysis_receipt, grad_cam_png_base64: analysis.grad_cam_png_base64 ?? null }),
    }, timeoutMs);
    if (!response.ok) return { ok: false, message: "The validation service could not generate the derived research report." };
    const declaredLength = Number(response.headers.get("Content-Length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REPORT_BYTES) {
      return { ok: false, message: "The validation service returned an oversized report payload." };
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_REPORT_BYTES) return { ok: false, message: "The validation service returned an oversized report payload." };
    if (bytes.length < 5 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== "%PDF") {
      return { ok: false, message: "The validation service returned an invalid report payload." };
    }
    return { ok: true, base64: bytesToBase64(bytes) };
  } catch (error) {
    return { ok: false, message: isAbortError(error) ? "Report generation timed out. Please retry once." : "The validation service could not be reached to generate the derived research report." };
  }
}

export async function askResearchExplanation(
  request: ResearchExplanationRequest,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = CHAT_TIMEOUT_MS,
): Promise<ResearchExplanationResult> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) return { ok: false, message: "The research explanation service is not configured." };
  try {
    const response = await fetchWithTimeout(fetchImpl, `${baseUrl}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }, timeoutMs);
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== "object") {
      return { ok: false, message: safeMessage(payload, "The research explanation service is unavailable.") };
    }
    const candidate = chatResponseSchema.safeParse(payload);
    if (!candidate.success) {
      return { ok: false, message: "The research explanation response was incomplete." };
    }
    return { ok: true, answer: candidate.data.answer, source: candidate.data.source, category: candidate.data.category, medical_advice_refused: candidate.data.medical_advice_refused, manual_review_reminder: candidate.data.manual_review_reminder, disclaimer_required: candidate.data.disclaimer_required };
  } catch (error) {
    return { ok: false, message: isAbortError(error) ? "The research explanation request timed out. Please retry once." : "The research explanation service could not be reached." };
  }
}
