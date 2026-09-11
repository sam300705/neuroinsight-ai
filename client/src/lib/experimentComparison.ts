export type ExperimentComparisonRecord = {
  experimentId: "EXP-005" | "EXP-006";
  datasetId: "DATA-003" | "DATA-004";
  architecture: string;
  imageSize: number;
  validationAccuracy: number;
  validationMacroF1: number;
  heldOutAccuracy: number;
  heldOutMacroF1: number;
  heldOutWeightedF1: number;
  patientCaseDisjoint: boolean;
  externalValidation: boolean;
  calibratedForRelease: boolean;
  onnxReleaseArtifact: boolean;
  releaseStatus: "active_mode_a" | "research_only_not_promoted";
};

export const experimentComparisonRecords: readonly ExperimentComparisonRecord[] = Object.freeze([
  {
    experimentId: "EXP-005",
    datasetId: "DATA-003",
    architecture: "ResNet50 frozen backbone + trained four-class head",
    imageSize: 160,
    validationAccuracy: 0.8186,
    validationMacroF1: 0.8238,
    heldOutAccuracy: 0.8099,
    heldOutMacroF1: 0.808,
    heldOutWeightedF1: 0.811,
    patientCaseDisjoint: false,
    externalValidation: false,
    calibratedForRelease: true,
    onnxReleaseArtifact: true,
    releaseStatus: "active_mode_a",
  },
  {
    experimentId: "EXP-006",
    datasetId: "DATA-004",
    architecture: "ResNet18 frozen backbone + trained four-class head",
    imageSize: 128,
    validationAccuracy: 0.8556,
    validationMacroF1: 0.8566,
    heldOutAccuracy: 0.751,
    heldOutMacroF1: 0.7501,
    heldOutWeightedF1: 0.7513,
    patientCaseDisjoint: false,
    externalValidation: false,
    calibratedForRelease: false,
    onnxReleaseArtifact: false,
    releaseStatus: "research_only_not_promoted",
  },
]);

export type PromotionReview = {
  incumbent: ExperimentComparisonRecord;
  candidate: ExperimentComparisonRecord;
  candidateImprovesHeldOutAccuracy: boolean;
  candidateImprovesHeldOutMacroF1: boolean;
  evidenceScopeImproved: boolean;
  automaticPromotionAllowed: false;
  recommendation: "retain_incumbent" | "eligible_for_separate_owner_review";
  reasons: string[];
};

export function reviewCandidatePromotion(
  incumbent: ExperimentComparisonRecord,
  candidate: ExperimentComparisonRecord,
): PromotionReview {
  const accuracyImproved = candidate.heldOutAccuracy > incumbent.heldOutAccuracy;
  const macroF1Improved = candidate.heldOutMacroF1 > incumbent.heldOutMacroF1;
  const evidenceScopeImproved =
    (candidate.patientCaseDisjoint && !incumbent.patientCaseDisjoint) ||
    (candidate.externalValidation && !incumbent.externalValidation);

  const reasons: string[] = [];
  if (!accuracyImproved) reasons.push("Candidate does not improve held-out image-level accuracy.");
  if (!macroF1Improved) reasons.push("Candidate does not improve held-out image-level macro-F1.");
  if (!candidate.patientCaseDisjoint) reasons.push("Candidate does not establish patient/case-disjoint evidence.");
  if (!candidate.externalValidation) reasons.push("Candidate does not establish external validation.");
  if (!candidate.calibratedForRelease) reasons.push("Candidate has no accepted release calibration/abstention evidence.");
  if (!candidate.onnxReleaseArtifact) reasons.push("Candidate has no accepted checksum-verified ONNX release artifact.");

  const eligible = accuracyImproved && macroF1Improved && candidate.calibratedForRelease && candidate.onnxReleaseArtifact;
  return {
    incumbent,
    candidate,
    candidateImprovesHeldOutAccuracy: accuracyImproved,
    candidateImprovesHeldOutMacroF1: macroF1Improved,
    evidenceScopeImproved,
    automaticPromotionAllowed: false,
    recommendation: eligible ? "eligible_for_separate_owner_review" : "retain_incumbent",
    reasons,
  };
}

export function currentExperimentPromotionReview() {
  const incumbent = experimentComparisonRecords.find(record => record.experimentId === "EXP-005");
  const candidate = experimentComparisonRecords.find(record => record.experimentId === "EXP-006");
  if (!incumbent || !candidate) throw new Error("Canonical experiment comparison records are incomplete.");
  return reviewCandidatePromotion(incumbent, candidate);
}

export function exportExperimentComparison() {
  return {
    schema_version: "neuroinsight-experiment-comparison/v1",
    generated_from: "declared_experiment_ledger",
    records: experimentComparisonRecords,
    promotion_review: currentExperimentPromotionReview(),
    aggregate_model_score: null,
    note: "Model promotion is evidence-gated and owner-reviewed; this export intentionally does not compute a single weighted model score.",
  };
}
