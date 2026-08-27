import type { AnalysisMode } from "@shared/neuroinsight";

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

export async function validateWithInferenceService(
  file: File,
  mode: AnalysisMode,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
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
    const response = await fetchImpl(`${baseUrl}/api/v1/analyze`, {
      method: "POST",
      headers: { "x-request-id": requestId },
      body: form,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: safeMessage(payload, "The server-side validation service could not process this upload."),
      };
    }

    const candidate = payload as Partial<InferenceAnalysisResponse>;
    if (!candidate.scan_id || !candidate.mode || !candidate.status) {
      return { ok: false, message: "The validation service returned an incomplete response. No model output is available." };
    }
    return { ok: true, response: candidate as InferenceAnalysisResponse };
  } catch {
    return {
      ok: false,
      message:
        "The server-side validation service could not be reached. No scan was submitted and no model output has been generated.",
    };
  }
}

export async function generateResearchReport(
  analysis: InferenceAnalysisResponse,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; base64: string } | { ok: false; message: string }> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) return { ok: false, message: "The validation service is not configured, so no derived report can be generated." };
  if (!analysis.analysis_receipt) return { ok: false, message: "This result does not include a current server-issued report receipt, so a derived report cannot be generated." };

  try {
    const response = await fetchImpl(`${baseUrl}/api/v1/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysis_receipt: analysis.analysis_receipt, grad_cam_png_base64: analysis.grad_cam_png_base64 ?? null }),
    });
    if (!response.ok) return { ok: false, message: "The validation service could not generate the derived research report." };
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 5 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== "%PDF") {
      return { ok: false, message: "The validation service returned an invalid report payload." };
    }
    return { ok: true, base64: bytesToBase64(bytes) };
  } catch {
    return { ok: false, message: "The validation service could not be reached to generate the derived research report." };
  }
}

export async function askResearchExplanation(
  request: ResearchExplanationRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<ResearchExplanationResult> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) return { ok: false, message: "The research explanation service is not configured." };
  try {
    const response = await fetchImpl(`${baseUrl}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== "object") {
      return { ok: false, message: safeMessage(payload, "The research explanation service is unavailable.") };
    }
    const candidate = payload as { answer?: unknown; source?: unknown; category?: unknown; medical_advice_refused?: unknown; manual_review_reminder?: unknown; disclaimer_required?: unknown };
    if (
      typeof candidate.answer !== "string" ||
      !candidate.answer.trim() ||
      !["offline_faq", "openai", "gemini"].includes(String(candidate.source)) ||
      typeof candidate.category !== "string" ||
      typeof candidate.medical_advice_refused !== "boolean" ||
      typeof candidate.manual_review_reminder !== "boolean" ||
      typeof candidate.disclaimer_required !== "boolean"
    ) {
      return { ok: false, message: "The research explanation response was incomplete." };
    }
    return { ok: true, answer: candidate.answer, source: candidate.source as "offline_faq" | "openai" | "gemini", category: candidate.category, medical_advice_refused: candidate.medical_advice_refused, manual_review_reminder: candidate.manual_review_reminder, disclaimer_required: candidate.disclaimer_required };
  } catch {
    return { ok: false, message: "The research explanation service could not be reached." };
  }
}
