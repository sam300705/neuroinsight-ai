import type { AnalysisMode } from "@shared/neuroinsight";

export type InferenceAnalysisResponse = {
  request_id: string;
  scan_id: string;
  mode: AnalysisMode;
  status: "unavailable" | "ready" | "incompatible";
  model_version: string;
  processing_time_ms: number;
  manual_review_recommended: boolean;
  warnings: string[];
  limitations: string[];
};

export type InferenceValidationResult =
  | { ok: true; response: InferenceAnalysisResponse }
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
