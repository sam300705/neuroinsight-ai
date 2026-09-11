import { describe, expect, it } from "vitest";
import {
  calibrationBins,
  expectedCalibrationError,
  riskCoverageCurve,
  summarizeReliability,
  topLabelBrierScore,
  wilsonAccuracyInterval,
} from "./reliabilityMetrics";

describe("reliability metrics", () => {
  const samples = [
    { confidence: 0.9, correct: true },
    { confidence: 0.6, correct: false },
  ] as const;

  it("computes top-label calibration and Brier evidence", () => {
    expect(expectedCalibrationError(samples, 2)).toBeCloseTo(0.25, 8);
    expect(topLabelBrierScore(samples)).toBeCloseTo(0.185, 8);
    const bins = calibrationBins(samples, 2);
    expect(bins[1]).toMatchObject({ count: 2, accuracy: 0.5, meanConfidence: 0.75 });
  });

  it("builds a selective risk-coverage curve ordered by confidence", () => {
    const curve = riskCoverageCurve([
      { confidence: 0.95, correct: true },
      { confidence: 0.8, correct: false },
      { confidence: 0.55, correct: true },
      { confidence: 0.3, correct: false },
    ], 4);
    expect(curve[0]).toMatchObject({ coverage: 0.25, accepted: 1, threshold: 0.95, accuracy: 1, risk: 0 });
    expect(curve.at(-1)).toMatchObject({ coverage: 1, accepted: 4, threshold: 0.3, accuracy: 0.5, risk: 0.5 });
  });

  it("returns a bounded Wilson interval", () => {
    const interval = wilsonAccuracyInterval(81, 100);
    expect(interval.estimate).toBe(0.81);
    expect(interval.lower).toBeGreaterThan(0);
    expect(interval.lower).toBeLessThan(interval.estimate);
    expect(interval.upper).toBeGreaterThan(interval.estimate);
    expect(interval.upper).toBeLessThanOrEqual(1);
  });

  it("summarizes reliability without creating a clinical guarantee", () => {
    const summary = summarizeReliability(samples, { calibrationBins: 2, curvePoints: 2 });
    expect(summary.sampleCount).toBe(2);
    expect(summary.accuracy).toBe(0.5);
    expect(summary.scope).toBe("labeled_top_confidence_research_evidence");
    expect(summary.clinicalGuarantee).toBe(false);
  });

  it("fails closed on malformed confidence evidence", () => {
    expect(() => expectedCalibrationError([{ confidence: 1.1, correct: true }], 10)).toThrow(/between 0 and 1/);
    expect(() => wilsonAccuracyInterval(4, 3)).toThrow(/successes/);
  });
});
