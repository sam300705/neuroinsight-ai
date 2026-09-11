import { describe, expect, it } from "vitest";
import { buildResearchPassport } from "./researchPassport";
import {
  buildResearchPassportV2,
  sha256Text,
  verifyResearchPassportV2Integrity,
} from "./researchPassportV2";
import type { InferenceAnalysisResponse } from "./inferenceApi";

function analysis(): InferenceAnalysisResponse {
  return {
    request_id: "passport-v2-request",
    scan_id: "11111111-1111-4111-8111-111111111111",
    mode: "classification",
    status: "complete",
    model_version: "bdneuro-v7-resnet50-head-only-exp005",
    processing_time_ms: 100,
    manual_review_recommended: false,
    predicted_class: "glioma",
    model_confidence_score: 0.91,
    calibrated: true,
    uncertainty_reason: null,
    measurement: { kind: "unavailable", metadata_confirmed: false, limitation: "No segmentation." },
    grad_cam_png_base64: "YWJj",
    analysis_receipt: "signed-receipt-example",
    warnings: ["research only"],
    limitations: ["image-level evidence"],
  };
}

describe("research passport v2", () => {
  it("binds the v1 payload and receipt by SHA-256 without exposing the receipt", async () => {
    const result = analysis();
    const v1 = buildResearchPassport({
      analysis: result,
      fileName: "research.png",
      fileSize: 1200,
      inputSha256: "a".repeat(64),
      generatedAt: "2026-09-11T00:00:00.000Z",
    });
    const v2 = await buildResearchPassportV2({
      passportV1: v1,
      analysis: result,
      releaseManifestSha256: "b".repeat(64),
      generatedAt: "2026-09-11T00:00:01.000Z",
    });

    expect(v2.schema_version).toBe("neuroinsight-research-passport/v2");
    expect(v2.integrity.analysis_receipt_sha256).toBe(await sha256Text("signed-receipt-example"));
    expect(JSON.stringify(v2)).not.toContain("signed-receipt-example");
    expect(v2.integrity.public_key_attestation).toBeNull();
    expect(v2.release_context.mode_b_status).toBe("unavailable");
    expect(await verifyResearchPassportV2Integrity(v2)).toMatchObject({ ok: true });
  });

  it("detects tampering with the embedded passport payload", async () => {
    const result = analysis();
    const v1 = buildResearchPassport({ analysis: result, fileName: "research.png", fileSize: 1200 });
    const v2 = await buildResearchPassportV2({ passportV1: v1, analysis: result });
    const tampered = {
      ...v2,
      payload: {
        ...v2.payload,
        analysis: { ...v2.payload.analysis, model_confidence_score: 0.99 },
      },
    };
    expect(await verifyResearchPassportV2Integrity(tampered)).toMatchObject({
      ok: false,
      reason: "payload_digest_mismatch",
    });
  });

  it("refuses to bind a passport to a different analysis", async () => {
    const result = analysis();
    const v1 = buildResearchPassport({ analysis: result, fileName: "research.png", fileSize: 1200 });
    await expect(buildResearchPassportV2({
      passportV1: v1,
      analysis: { ...result, request_id: "different-request" },
    })).rejects.toThrow(/request identifiers/);
  });
});
