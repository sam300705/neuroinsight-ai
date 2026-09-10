import { describe, expect, it } from "vitest";
import {
  currentExperimentPromotionReview,
  experimentComparisonRecords,
  exportExperimentComparison,
  reviewCandidatePromotion,
} from "./experimentComparison";

describe("experiment comparison", () => {
  it("retains EXP-005 over the weaker EXP-006 held-out result", () => {
    const review = currentExperimentPromotionReview();
    expect(review.incumbent.experimentId).toBe("EXP-005");
    expect(review.candidate.experimentId).toBe("EXP-006");
    expect(review.candidateImprovesHeldOutAccuracy).toBe(false);
    expect(review.candidateImprovesHeldOutMacroF1).toBe(false);
    expect(review.recommendation).toBe("retain_incumbent");
    expect(review.automaticPromotionAllowed).toBe(false);
  });

  it("never turns a stronger synthetic candidate into an automatic promotion", () => {
    const incumbent = experimentComparisonRecords[0];
    const candidate = {
      ...experimentComparisonRecords[1],
      heldOutAccuracy: 0.9,
      heldOutMacroF1: 0.9,
      calibratedForRelease: true,
      onnxReleaseArtifact: true,
    };
    const review = reviewCandidatePromotion(incumbent, candidate);
    expect(review.recommendation).toBe("eligible_for_separate_owner_review");
    expect(review.automaticPromotionAllowed).toBe(false);
  });

  it("exports no aggregate model score", () => {
    const exported = exportExperimentComparison();
    expect(exported.aggregate_model_score).toBeNull();
    expect(exported.records).toHaveLength(2);
  });
});
