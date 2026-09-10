import { describe, expect, it } from "vitest";
import { exportPerturbationEvidence, summarizePerturbationEvidence } from "./robustnessEvidence";

const observations = [
  {
    perturbationId: "brightness_minus_05",
    baselineClass: "glioma",
    perturbedClass: "glioma",
    baselineStatus: "complete",
    perturbedStatus: "complete",
    baselineConfidence: 0.91,
    perturbedConfidence: 0.88,
    attributionAvailable: true,
  },
  {
    perturbationId: "contrast_plus_05",
    baselineClass: "glioma",
    perturbedClass: "meningioma",
    baselineStatus: "complete",
    perturbedStatus: "low_confidence",
    baselineConfidence: 0.91,
    perturbedConfidence: 0.52,
    attributionAvailable: true,
  },
] as const;

describe("perturbation evidence", () => {
  it("reports descriptive stability and drift without declaring robustness", () => {
    const summary = summarizePerturbationEvidence(observations);
    expect(summary.classStabilityFraction).toBe(0.5);
    expect(summary.statusStabilityFraction).toBe(0.5);
    expect(summary.meanAbsoluteConfidenceDrift).toBeCloseTo(0.21, 8);
    expect(summary.maximumAbsoluteConfidenceDrift).toBeCloseTo(0.39, 8);
    expect(summary.robustnessClaimEstablished).toBe(false);
    expect(summary.oodDetectionEstablished).toBe(false);
  });

  it("exports no aggregate robustness score", () => {
    const exported = exportPerturbationEvidence(observations);
    expect(exported.aggregate_robustness_score).toBeNull();
    expect(exported.protocol).toBe("neuroinsight-robustness-protocol/v1");
  });

  it("fails closed on malformed confidence values", () => {
    expect(() => summarizePerturbationEvidence([{ ...observations[0], perturbedConfidence: 1.2 }])).toThrow(/between 0 and 1/);
  });
});
