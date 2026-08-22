import { afterEach, describe, expect, it, vi } from "vitest";
import { validateWithInferenceService } from "./inferenceApi";

const file = new File(["not-a-real-image"], "corrupted.png", { type: "image/png" });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("validateWithInferenceService", () => {
  it("returns the authoritative FastAPI validation error for a corrupted upload", async () => {
    vi.stubEnv("VITE_INFERENCE_API_BASE_URL", "https://inference.example/");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ request_id: "request-1", detail: "Image payload is corrupted or cannot be decoded." }), { status: 422 }),
    );

    const result = await validateWithInferenceService(file, "classification", "request-1", fetchMock);

    expect(result).toEqual({ ok: false, message: "Image payload is corrupted or cannot be decoded." });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://inference.example/api/v1/analyze",
      expect.objectContaining({ method: "POST", headers: { "x-request-id": "request-1" } }),
    );
  });

  it("preserves an honest model-unavailable server response after validation succeeds", async () => {
    vi.stubEnv("VITE_INFERENCE_API_BASE_URL", "https://inference.example");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        request_id: "request-2", scan_id: "1302e92e-9b7e-43c7-825b-d767b65ea2ee", mode: "classification", status: "unavailable", model_version: "unconfigured", processing_time_ms: 12, manual_review_recommended: true, warnings: ["No verified artifact is configured."], limitations: ["Academic use only."],
      }), { status: 200 }),
    );

    const result = await validateWithInferenceService(file, "classification", "request-2", fetchMock);

    expect(result).toMatchObject({ ok: true, response: { scan_id: "1302e92e-9b7e-43c7-825b-d767b65ea2ee", status: "unavailable", manual_review_recommended: true } });
  });

  it("preserves real experimental classifier output without renaming the model-confidence score as a medical probability", async () => {
    vi.stubEnv("VITE_INFERENCE_API_BASE_URL", "https://inference.example");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        request_id: "request-4", scan_id: "86fd1bd7-b0ad-4125-9a4b-1c0d91655781", mode: "classification", status: "complete", model_version: "bdneuro-v7-resnet50-head-only-exp005", processing_time_ms: 314, manual_review_recommended: true, predicted_class: "meningioma", model_confidence_score: 0.8259, calibrated: true, grad_cam_png_base64: "real-base64-overlay", warnings: ["Experimental image-level academic result."], limitations: ["Not a medical diagnosis."],
      }), { status: 200 }),
    );

    const result = await validateWithInferenceService(file, "classification", "request-4", fetchMock);

    expect(result).toMatchObject({ ok: true, response: { status: "complete", predicted_class: "meningioma", model_confidence_score: 0.8259, calibrated: true, grad_cam_png_base64: "real-base64-overlay" } });
  });

  it("does not submit uploads when the external validation service is not configured", async () => {
    vi.stubEnv("VITE_INFERENCE_API_BASE_URL", "");
    const fetchMock = vi.fn();

    const result = await validateWithInferenceService(file, "classification", "request-3", fetchMock);

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    if (!result.ok) expect(result.message).toContain("not configured");
  });
});
