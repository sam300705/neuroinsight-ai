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

  it("localizes real experimental-result and derived-artifact persistence controls", () => {
    for (const language of ["en", "hi"] as const) {
      const results = copyFor(language).results;
      expect(results.experimentalResult).not.toHaveLength(0);
      expect(results.saveTitle).not.toHaveLength(0);
      expect(results.saveDetail).not.toHaveLength(0);
      expect(results.signInSave).not.toHaveLength(0);
    }
    expect(copyFor("hi").results.saveTitle).toContain("आर्टिफैक्ट");
  });

  it("reports the verified Mode A experimental status without overstating Mode B", () => {
    expect(copyFor("en").home.modelTitle).toContain("Mode A");
    expect(copyFor("en").home.modelDetail).toContain("Mode B segmentation remains unavailable");
    expect(copyFor("en").performance.intro).toContain("EXP-005");
    expect(copyFor("hi").home.modelTitle).toContain("मोड A");
    expect(copyFor("hi").performance.intro).toContain("EXP-005");
  });

  it("describes History as account-scoped Mode A metadata with fresh ownership-checked downloads", () => {
    const english = copyFor("en").history;
    const hindi = copyFor("hi").history;
    expect(english.title).toContain("Account-linked");
    expect(english.intro).toContain("account-scoped");
    expect(english.emptyDetail).toContain("fresh ownership-checked download");
    expect(english.emptyDetail).toContain("Mode B masks and 3D artifacts are unavailable");
    expect(english.emptyDetail).not.toContain("durable links");
    expect(hindi.title).toContain("खाता-लिंक्ड");
    expect(hindi.emptyDetail).toContain("मोड B मास्क");
    expect(hindi.previous).not.toHaveLength(0);
    expect(hindi.next).not.toHaveLength(0);
  });
});
