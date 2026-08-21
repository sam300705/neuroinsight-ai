import { describe, expect, it } from "vitest";
import { disclaimerCopy } from "./ResearchDisclaimers";

describe("bilingual research disclaimers", () => {
  it("preserves explicit non-diagnostic academic-use wording in English and Hindi", () => {
    expect(disclaimerCopy("en").academic).toContain("not provide a medical diagnosis");
    expect(disclaimerCopy("hi").academic).toContain("चिकित्सीय निदान");
  });

  it("preserves the Grad-CAM and glioma-scope boundaries in both languages", () => {
    expect(disclaimerCopy("en").gradCam).toContain("not an exact tumor boundary");
    expect(disclaimerCopy("hi").gradCam).toContain("ट्यूमर की सीमा");
    expect(disclaimerCopy("en").glioma).toContain("glioma-focused");
    expect(disclaimerCopy("hi").glioma).toContain("ग्लायोमा-केंद्रित");
  });
});
