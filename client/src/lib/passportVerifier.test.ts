import { describe, expect, it, vi } from "vitest";
import { buildResearchPassport } from "./researchPassport";
import {
  parseResearchPassportText,
  passportIntegritySummary,
  verifyPassportSourceFile,
} from "./passportVerifier";
import type { InferenceAnalysisResponse } from "./inferenceApi";

function analysis(): InferenceAnalysisResponse {
  return {
    request_id: "req-passport-test",
    scan_id: "4bd2757f-ccf4-45e0-ad2d-5a6ea239a01a",
    mode: "classification",
    status: "complete",
    model_version: "bdneuro-v7-resnet50-head-only-exp005",
    processing_time_ms: 42,
    manual_review_recommended: true,
    predicted_class: "glioma",
    model_confidence_score: 0.91,
    calibrated: true,
    uncertainty_reason: null,
    measurement: {
      kind: "unavailable",
      metadata_confirmed: false,
      limitation: "Classification has no segmentation measurement.",
    },
    grad_cam_png_base64: "YWJj",
    analysis_receipt: "receipt-present",
    warnings: ["research only"],
    limitations: ["not clinically validated"],
  };
}

function passportText() {
  return JSON.stringify(buildResearchPassport({
    analysis: analysis(),
    fileName: "source.png",
    fileSize: 3,
    inputSha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    generatedAt: "2026-09-11T00:00:00.000Z",
  }));
}

describe("passport verifier", () => {
  it("accepts a current v1 passport and exposes bounded integrity semantics", () => {
    const parsed = parseResearchPassportText(passportText());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const summary = passportIntegritySummary(parsed.passport);
    expect(summary.schemaRecognized).toBe(true);
    expect(summary.serverReceiptWasAvailable).toBe(true);
    expect(summary.cryptographicReceiptVerifiedHere).toBe(false);
  });

  it("rejects malformed and unknown passport payloads", () => {
    expect(parseResearchPassportText("not-json").ok).toBe(false);
    expect(parseResearchPassportText(JSON.stringify({ schema_version: "future" })).ok).toBe(false);
  });

  it("matches the source bytes against the exported SHA-256 fingerprint", async () => {
    const parsed = parseResearchPassportText(passportText());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const file = new File([new TextEncoder().encode("abc")], "source.png", { type: "image/png" });
    const result = await verifyPassportSourceFile(parsed.passport, file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.match).toBe(true);
  });

  it("reports a mismatch without sending the source file anywhere", async () => {
    const parsed = parseResearchPassportText(passportText());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const file = new File([new TextEncoder().encode("different")], "source.png", { type: "image/png" });
    const result = await verifyPassportSourceFile(parsed.passport, file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.match).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
