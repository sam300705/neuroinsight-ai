import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { V32Result, findingLabel } from "./V32Result";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "en" }),
}));

describe("v3.2 disagreement presentation", () => {
  it("preserves the outline when the classifier predicts no tumor", () => {
    const finding = {
      class: "no_tumor",
      confidence: 0.97,
      schema_version: "neuroinsight-finding/v1",
      final_label: "possible_tumor (type unclear)",
      tumor_detected: true,
      needs_review: true,
      review_reasons: ["classifier: no_tumor, but segmentation found a tumor region"],
      mask_uncertain: true,
      mask_notes: [],
      image: { width: 128, height: 128 },
      bbox: { x_min: 20, x_max: 70, y_min: 20, y_max: 70 },
      tumor_area_px: 100,
      tumor_pct_of_image: 0.61,
      tumor_pct_of_brain: 2,
      mask_png_base64: "YWJj",
      overlay_png_base64: "YWJj",
    } as const;
    const markup = renderToStaticMarkup(createElement(V32Result, { analysis: {
      request_id: "synthetic-contrast-case",
      scan_id: "11111111-1111-4111-8111-111111111111",
      mode: "classification",
      status: "low_confidence",
      model_version: "neuroinsight-ai-v3.2",
      processing_time_ms: 100,
      manual_review_recommended: true,
      predicted_class: "no_tumor",
      model_confidence_score: 0.97,
      measurement: { kind: "relative_area", metadata_confirmed: false, limitation: "Synthetic test." },
      warnings: [],
      limitations: [],
      finding: { ...finding, mask_notes: [], review_reasons: [...finding.review_reasons] },
    } }));
    expect(findingLabel(finding.final_label, "en")).toBe("Possible tumor — type unclear");
    expect(markup).toContain('alt="Predicted 2D outline"');
    expect(markup).toContain("Classifier confidence");
    expect(markup).toContain("97.0%");
    expect(markup).toContain("The classifier predicted no tumor, but segmentation found a region.");
    expect(markup).toContain("The predicted outline is uncertain.");
  });
});
