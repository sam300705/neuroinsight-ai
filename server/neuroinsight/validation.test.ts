import { describe, expect, it } from "vitest";
import { z } from "zod";
import { artifactRegistrationSchema, scanResultSchema, validateArtifactPayload } from "./validation";

describe("NeuroInsight scan persistence validation", () => {
  const unavailable = { scanId: "f67b8799-e813-4667-918f-e70261974db6", mode: "classification" as const, status: "unavailable" as const, modelVersion: "no-deployable-model", processingTimeMs: 0, calibrated: false, manualReviewRecommended: true, measurement: { kind: "unavailable" as const, metadataConfirmed: false, limitation: "No verified model artifact is configured." }, warnings: ["No result has been generated."] };
  it("accepts an honest unavailable result without inventing a confidence score", () => expect(scanResultSchema.parse(unavailable).confidenceScore).toBeUndefined());
  it("requires the exact delete-all confirmation phrase", () => expect(() => z.literal("DELETE_ALL_RESEARCH_HISTORY").parse("DELETE")).toThrow());
  it("rejects a mismatched derived-artifact signature", () => expect(() => validateArtifactPayload(Buffer.from("not png").toString("base64"), "image/png")).toThrow("valid PNG"));
  it("accepts a correctly constrained derived artifact registration", () => expect(artifactRegistrationSchema.parse({ scanId: unavailable.scanId, artifactType: "report", contentType: "application/pdf", fileName: "report.pdf", base64: Buffer.from("%PDF-1.4\n").toString("base64") }).artifactType).toBe("report"));
});
