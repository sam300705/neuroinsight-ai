export type LabeledConfidence = {
  confidence: number;
  correct: boolean;
};

export type CalibrationBin = {
  lower: number;
  upper: number;
  count: number;
  meanConfidence: number;
  accuracy: number;
  absoluteGap: number;
};

export type RiskCoveragePoint = {
  coverage: number;
  accepted: number;
  threshold: number;
  accuracy: number;
  risk: number;
};

export type WilsonInterval = {
  estimate: number;
  lower: number;
  upper: number;
};

function assertSamples(samples: readonly LabeledConfidence[]) {
  if (!samples.length) throw new Error("Reliability metrics require at least one labeled sample.");
  for (const sample of samples) {
    if (!Number.isFinite(sample.confidence) || sample.confidence < 0 || sample.confidence > 1) {
      throw new Error("Confidence values must be finite numbers between 0 and 1.");
    }
  }
}

export function calibrationBins(
  samples: readonly LabeledConfidence[],
  binCount = 10,
): CalibrationBin[] {
  assertSamples(samples);
  if (!Number.isInteger(binCount) || binCount < 2 || binCount > 100) {
    throw new Error("Calibration bin count must be an integer between 2 and 100.");
  }

  const buckets = Array.from({ length: binCount }, () => ({ count: 0, confidence: 0, correct: 0 }));
  for (const sample of samples) {
    const index = Math.min(binCount - 1, Math.floor(sample.confidence * binCount));
    const bucket = buckets[index];
    bucket.count += 1;
    bucket.confidence += sample.confidence;
    bucket.correct += sample.correct ? 1 : 0;
  }

  return buckets.map((bucket, index) => {
    const lower = index / binCount;
    const upper = (index + 1) / binCount;
    const meanConfidence = bucket.count ? bucket.confidence / bucket.count : 0;
    const accuracy = bucket.count ? bucket.correct / bucket.count : 0;
    return {
      lower,
      upper,
      count: bucket.count,
      meanConfidence,
      accuracy,
      absoluteGap: bucket.count ? Math.abs(accuracy - meanConfidence) : 0,
    };
  });
}

export function expectedCalibrationError(
  samples: readonly LabeledConfidence[],
  binCount = 10,
): number {
  const bins = calibrationBins(samples, binCount);
  return bins.reduce((ece, bin) => ece + (bin.count / samples.length) * bin.absoluteGap, 0);
}

export function topLabelBrierScore(samples: readonly LabeledConfidence[]): number {
  assertSamples(samples);
  return samples.reduce((total, sample) => {
    const target = sample.correct ? 1 : 0;
    return total + (sample.confidence - target) ** 2;
  }, 0) / samples.length;
}

export function riskCoverageCurve(
  samples: readonly LabeledConfidence[],
  requestedPoints = 20,
): RiskCoveragePoint[] {
  assertSamples(samples);
  if (!Number.isInteger(requestedPoints) || requestedPoints < 2 || requestedPoints > 100) {
    throw new Error("Risk-coverage point count must be an integer between 2 and 100.");
  }

  const sorted = [...samples].sort((a, b) => b.confidence - a.confidence);
  const counts = new Set<number>();
  for (let index = 1; index <= requestedPoints; index += 1) {
    counts.add(Math.min(sorted.length, Math.max(1, Math.ceil((index / requestedPoints) * sorted.length))));
  }
  counts.add(sorted.length);

  return Array.from(counts)
    .sort((a, b) => a - b)
    .map(accepted => {
      const selected = sorted.slice(0, accepted);
      const correct = selected.reduce((sum, sample) => sum + (sample.correct ? 1 : 0), 0);
      const accuracy = correct / accepted;
      return {
        coverage: accepted / sorted.length,
        accepted,
        threshold: selected[selected.length - 1].confidence,
        accuracy,
        risk: 1 - accuracy,
      };
    });
}

export function wilsonAccuracyInterval(
  successes: number,
  total: number,
  z = 1.959963984540054,
): WilsonInterval {
  if (!Number.isInteger(successes) || !Number.isInteger(total) || total <= 0 || successes < 0 || successes > total) {
    throw new Error("Wilson interval requires integer successes within a positive integer total.");
  }
  if (!Number.isFinite(z) || z <= 0) throw new Error("Wilson z-score must be positive and finite.");

  const estimate = successes / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (estimate + z2 / (2 * total)) / denominator;
  const margin = (z / denominator) * Math.sqrt((estimate * (1 - estimate) + z2 / (4 * total)) / total);
  return {
    estimate,
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

export function summarizeReliability(
  samples: readonly LabeledConfidence[],
  options: { calibrationBins?: number; curvePoints?: number } = {},
) {
  assertSamples(samples);
  const correct = samples.reduce((sum, sample) => sum + (sample.correct ? 1 : 0), 0);
  return {
    sampleCount: samples.length,
    accuracy: correct / samples.length,
    accuracyInterval95: wilsonAccuracyInterval(correct, samples.length),
    expectedCalibrationError: expectedCalibrationError(samples, options.calibrationBins ?? 10),
    topLabelBrierScore: topLabelBrierScore(samples),
    riskCoverage: riskCoverageCurve(samples, options.curvePoints ?? 20),
    scope: "labeled_top_confidence_research_evidence" as const,
    clinicalGuarantee: false as const,
  };
}
