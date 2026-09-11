import { describe, expect, it } from "vitest";
import {
  buildResearchPassport,
  evaluateRepeatability,
} from "./researchPassport";
import type { InferenceAnalysisResponse } from "./inferenceApi";

function response(
  confidence = 0.91,
  overrides: Partial<InferenceAnalysisResponse> = {},
): InferenceAnalysisResponse {
  return {
    request_id: crypto.randomUUID(),
    scan_id: crypto.randomUUID(),
    mode: "classification",
    status: "complete",
    model_version: "bdneuro-v7-resnet50-head-only-exp005",
    processing_time_ms: 120,
    manual_review_recommended: true,
    predicted_class: "glioma",
    model_confidence_score: confidence,
    calibrated: true,
    uncertainty_reason: null,
    measurement: {
      kind: "unavailable",
      metadata_confirmed: false,
      limitation: "Classification produces no segmentation mask.",
    },
    grad_cam_png_base64: "YWJj",
    analysis_receipt: "receipt",
    warnings: ["research only"],
    limitations: ["not clinically validated"],
    ...overrides,
  };
}

describe("research passport", () => {
  it("records evidence and explicit non-claims without changing model output", () => {
    const analysis = response();
    const passport = buildResearchPassport({
      analysis,
      fileName: "sample.png",
      fileSize: 1234,
      inputSha256: "a".repeat(64),
      generatedAt: "2026-09-11T00:00:00.000Z",
    });

    expect(passport.schema_version).toBe("neuroinsight-research-passport/v1");
    expect(passport.analysis.predicted_class).toBe("glioma");
    expect(passport.input.sha256).toBe("a".repeat(64));
    expect(passport.evidence.grad_cam_available).toBe(true);
    expect(passport.evidence.integrity_receipt_available).toBe(true);
    expect(passport.explicit_non_claims).toContain(
      "No conformal coverage guarantee is currently claimed.",
    );
  });

  it("passes deterministic same-input evidence within tolerance", () => {
    const evidence = evaluateRepeatability([
      response(0.91),
      response(0.9100002),
      response(0.9099998),
    ]);

    expect(evidence.runs).toBe(3);
    expect(evidence.stableClass).toBe(true);
    expect(evidence.passed).toBe(true);
    expect(evidence.confidenceSpread).toBeLessThanOrEqual(evidence.tolerance);
  });

  it("fails repeatability when the model decision changes", () => {
    const evidence = evaluateRepeatability([
      response(0.91),
      response(0.89, { predicted_class: "meningioma" }),
    ]);

    expect(evidence.stableClass).toBe(false);
    expect(evidence.passed).toBe(false);
  });
});
