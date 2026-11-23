import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { V32Finding } from "@shared/v32Finding";
import { V32Result, findingLabel } from "./V32Result";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "en" }),
}));

function renderResult(finding: V32Finding) {
  return renderToStaticMarkup(createElement(V32Result, {
    analysis: {
      request_id: "synthetic-v32-result",
      scan_id: "11111111-1111-4111-8111-111111111111",
      mode: "classification",
      status: "complete",
      model_version: "neuroinsight-ai-v3.2",
      processing_time_ms: 100,
      manual_review_recommended: true,
      predicted_class: finding.class,
      model_confidence_score: finding.confidence,
      measurement: {
        kind: finding.tumor_area_px === null ? "unavailable" : "relative_area",
        metadata_confirmed: false,
        limitation: "Synthetic test.",
      },
      warnings: [],
      limitations: [],
      finding,
    },
  }));
}

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
    const markup = renderResult({ ...finding, mask_notes: [], review_reasons: [...finding.review_reasons] });
    expect(findingLabel(finding.final_label, "en")).toBe("Possible tumor — type unclear");
    expect(markup).toContain('alt="Predicted 2D outline"');
    expect(markup).toContain("Classifier confidence");
    expect(markup).toContain("97.0%");
    expect(markup).toContain("The classifier predicted no tumor, but segmentation found a region.");
    expect(markup).toContain("The predicted outline is uncertain.");
  });
});

it("limits a negative finding to the submitted slice and explains that a tumor can be missed", () => {
  const finding: V32Finding = {
    schema_version: "neuroinsight-finding/v1",
    class: "no_tumor",
    confidence: 0.97,
    final_label: "no_tumor",
    tumor_detected: false,
    needs_review: false,
    review_reasons: [],
    mask_uncertain: false,
    mask_notes: [],
    image: { width: 128, height: 128 },
    bbox: null,
    tumor_area_px: null,
    tumor_pct_of_image: null,
    tumor_pct_of_brain: null,
    mask_png_base64: null,
    overlay_png_base64: null,
  };

  expect(findingLabel(finding.final_label, "en")).toBe("No tumor detected on this slice");
  expect(findingLabel(finding.final_label, "hi")).toBe("इस स्लाइस में ट्यूमर का पता नहीं चला");
  expect(renderResult(finding)).toContain("The model can miss tumors on a slice, even when classifier confidence is high.");
});
