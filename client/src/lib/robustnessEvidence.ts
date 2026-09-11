export type PerturbationObservation = {
  perturbationId: string;
  baselineClass: string | null;
  perturbedClass: string | null;
  baselineStatus: string;
  perturbedStatus: string;
  baselineConfidence: number | null;
  perturbedConfidence: number | null;
  attributionAvailable: boolean;
};

export type PerturbationEvidenceSummary = {
  observations: number;
  classComparable: number;
  classStable: number;
  classStabilityFraction: number | null;
  statusStable: number;
  statusStabilityFraction: number;
  confidenceComparable: number;
  meanAbsoluteConfidenceDrift: number | null;
  maximumAbsoluteConfidenceDrift: number | null;
  attributionAvailabilityFraction: number;
  robustnessClaimEstablished: false;
  oodDetectionEstablished: false;
};

function validateConfidence(value: number | null, field: string) {
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error(`${field} must be null or a finite number between 0 and 1.`);
  }
}

export function summarizePerturbationEvidence(
  observations: readonly PerturbationObservation[],
): PerturbationEvidenceSummary {
  if (!observations.length) throw new Error("Perturbation evidence requires at least one observation.");

  let classComparable = 0;
  let classStable = 0;
  let statusStable = 0;
  let confidenceComparable = 0;
  let confidenceDriftTotal = 0;
  let maximumAbsoluteConfidenceDrift = 0;
  let attributionAvailable = 0;

  for (const observation of observations) {
    if (!observation.perturbationId.trim() || observation.perturbationId.length > 128) {
      throw new Error("Perturbation identifiers must be bounded non-empty strings.");
    }
    validateConfidence(observation.baselineConfidence, "baselineConfidence");
    validateConfidence(observation.perturbedConfidence, "perturbedConfidence");

    if (observation.baselineClass !== null && observation.perturbedClass !== null) {
      classComparable += 1;
      if (observation.baselineClass === observation.perturbedClass) classStable += 1;
    }
    if (observation.baselineStatus === observation.perturbedStatus) statusStable += 1;
    if (observation.baselineConfidence !== null && observation.perturbedConfidence !== null) {
      const drift = Math.abs(observation.baselineConfidence - observation.perturbedConfidence);
      confidenceComparable += 1;
      confidenceDriftTotal += drift;
      maximumAbsoluteConfidenceDrift = Math.max(maximumAbsoluteConfidenceDrift, drift);
    }
    if (observation.attributionAvailable) attributionAvailable += 1;
  }

  return {
    observations: observations.length,
    classComparable,
    classStable,
    classStabilityFraction: classComparable ? classStable / classComparable : null,
    statusStable,
    statusStabilityFraction: statusStable / observations.length,
    confidenceComparable,
    meanAbsoluteConfidenceDrift: confidenceComparable ? confidenceDriftTotal / confidenceComparable : null,
    maximumAbsoluteConfidenceDrift: confidenceComparable ? maximumAbsoluteConfidenceDrift : null,
    attributionAvailabilityFraction: attributionAvailable / observations.length,
    robustnessClaimEstablished: false,
    oodDetectionEstablished: false,
  };
}

export function exportPerturbationEvidence(observations: readonly PerturbationObservation[]) {
  return {
    schema_version: "neuroinsight-perturbation-evidence/v1",
    protocol: "neuroinsight-robustness-protocol/v1",
    scope: "academic_non_clinical_research",
    summary: summarizePerturbationEvidence(observations),
    observations,
    aggregate_robustness_score: null,
    note: "These outputs are descriptive perturbation-stability evidence only. They do not establish OOD detection, scanner/protocol robustness, external validity, or clinical safety.",
  };
}
