import { afterEach, describe, expect, it, vi } from "vitest";
import { askResearchExplanation, generateResearchReport, validateWithInferenceService, type InferenceAnalysisResponse } from "./inferenceApi";

const file = new File(["not-a-real-image"], "corrupted.png", { type: "image/png" });
const realResponse: InferenceAnalysisResponse = { request_id: "request-report", scan_id: "1302e92e-9b7e-43c7-825b-d767b65ea2ee", mode: "classification", status: "complete", model_version: "bdneuro-v7-resnet50-head-only-exp005", processing_time_ms: 314, manual_review_recommended: true, predicted_class: "meningioma", model_confidence_score: 0.8259, calibrated: true, grad_cam_png_base64: "real-derived-overlay", analysis_receipt: "v1.server-issued-receipt.signature", measurement: { kind: "unavailable", metadata_confirmed: false, limitation: "Classification produces no mask or physical measurement." }, warnings: ["Experimental academic result."], limitations: ["Not a medical diagnosis."] };

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
        request_id: "request-4", scan_id: "86fd1bd7-b0ad-4125-9a4b-1c0d91655781", mode: "classification", status: "complete", model_version: "bdneuro-v7-resnet50-head-only-exp005", processing_time_ms: 314, manual_review_recommended: true, predicted_class: "meningioma", model_confidence_score: 0.8259, calibrated: true, grad_cam_png_base64: "real-base64-overlay", measurement: { kind: "unavailable", metadata_confirmed: false, limitation: "No mask." }, warnings: ["Experimental image-level academic result."], limitations: ["Not a medical diagnosis."],
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

  it("generates a PDF artifact request from real response metadata and derived Grad-CAM only", async () => {
    vi.stubEnv("VITE_INFERENCE_API_BASE_URL", "https://inference.example");
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]), { status: 200, headers: { "Content-Type": "application/pdf" } }));

    const result = await generateResearchReport(realResponse, fetchMock);

    expect(result).toEqual({ ok: true, base64: "JVBERi0xLjc=" });
    expect(fetchMock).toHaveBeenCalledWith("https://inference.example/api/v1/report", expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ analysis_receipt: "v1.server-issued-receipt.signature", grad_cam_png_base64: "real-derived-overlay" });
    expect(JSON.stringify(JSON.parse(fetchMock.mock.calls[0][1].body))).not.toMatch(/predicted_class|confidence|model_version|scan_id|warnings|limitations/i);
  });

  it("does not request, retry, or fabricate a report when the server did not issue a receipt", async () => {
    vi.stubEnv("VITE_INFERENCE_API_BASE_URL", "https://inference.example");
    const fetchMock = vi.fn();

    const result = await generateResearchReport({ ...realResponse, analysis_receipt: null }, fetchMock);

    expect(result).toEqual({ ok: false, message: "This result does not include a current server-issued report receipt, so a derived report cannot be generated." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only the explicitly allowlisted de-identified assistant fields from the browser", async () => {
    vi.stubEnv("VITE_INFERENCE_API_BASE_URL", "https://inference.example");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      answer: "The model score is research context only.", source: "offline_faq", category: "calibration", medical_advice_refused: false, manual_review_reminder: true, disclaimer_required: true,
    }), { status: 200 }));

    const result = await askResearchExplanation({
      question: "Explain confidence",
      language: "en",
      purpose: "result_summary",
      predicted_class: "meningioma",
      model_version: "bdneuro-v7-resnet50-head-only-exp005",
      model_confidence_score: 0.8259,
      calibrated: true,
      manual_review_recommended: true,
      grad_cam_available: true,
      uncertainty_reason: null,
      measurement_available: false,
    }, fetchMock);

    expect(result).toMatchObject({ ok: true, source: "offline_faq", category: "calibration" });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request).toEqual({ question: "Explain confidence", language: "en", purpose: "result_summary", predicted_class: "meningioma", model_version: "bdneuro-v7-resnet50-head-only-exp005", model_confidence_score: 0.8259, calibrated: true, manual_review_recommended: true, grad_cam_available: true, uncertainty_reason: null, measurement_available: false });
    expect(JSON.stringify(request)).not.toMatch(/file(name)?|scan_id|preview|grad_cam_png|data_url|storage|account|email|token|signed/i);
  });

  it("rejects an incomplete assistant response rather than displaying unvalidated provider content", async () => {
    vi.stubEnv("VITE_INFERENCE_API_BASE_URL", "https://inference.example");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ answer: "Unvalidated" }), { status: 200 }));

    await expect(askResearchExplanation({ question: "Explain Grad-CAM", language: "en" }, fetchMock)).resolves.toEqual({ ok: false, message: "The research explanation response was incomplete." });
  });
});
