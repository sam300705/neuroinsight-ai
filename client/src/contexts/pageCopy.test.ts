import { describe, expect, it } from "vitest";
import { copyFor } from "./pageCopy";

describe("dashboard bilingual page copy", () => {
  it("provides non-empty English and Hindi content for every active routed page", () => {
    for (const language of ["en", "hi"] as const) {
      const copy = copyFor(language);
      expect(copy.home.title).not.toHaveLength(0);
      expect(copy.analyse.title).not.toHaveLength(0);
      expect(copy.results.title).not.toHaveLength(0);
      expect(copy.history.title).not.toHaveLength(0);
      expect(copy.methodology.title).not.toHaveLength(0);
      expect(copy.methodology.steps).toHaveLength(4);
      expect(copy.methodology.cards).toHaveLength(3);
      expect(copy.performance.title).not.toHaveLength(0);
      expect(copy.performance.cards).toHaveLength(2);
      expect(copy.limitations.title).not.toHaveLength(0);
      expect(copy.limitations.items).toHaveLength(7);
      expect(copy.about.title).not.toHaveLength(0);
      expect(copy.about.cards).toHaveLength(3);
      expect(copy.notFound.title).not.toHaveLength(0);
    }
  });

  it("retains explicit non-medical wording in both available languages", () => {
    expect(copyFor("en").results.noProbability).toContain("medical probability");
    expect(copyFor("hi").results.noProbability).toContain("चिकित्सीय");
  });
});
