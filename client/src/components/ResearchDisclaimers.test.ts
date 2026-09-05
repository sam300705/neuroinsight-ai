import { describe, expect, it } from "vitest";
import { disclaimerCopy } from "./ResearchDisclaimers";

describe("bilingual research disclaimers", () => {
  it("preserves explicit non-diagnostic academic-use wording in English and Hindi", () => {
    const requiredDisclaimer = "This system is not a medical diagnosis and must not replace a qualified radiologist.";
    expect(disclaimerCopy("en").academic).toContain(requiredDisclaimer);
    expect(disclaimerCopy("hi").academic).toContain("चिकित्सीय निदान");
    expect(disclaimerCopy("hi").academic).toContain(requiredDisclaimer);
  });

  it("preserves the Grad-CAM and glioma-scope boundaries in both languages", () => {
    expect(disclaimerCopy("en").gradCam).toContain("not an exact tumor boundary");
    expect(disclaimerCopy("hi").gradCam).toContain("ट्यूमर की सीमा");
    expect(disclaimerCopy("en").glioma).toContain("glioma-focused");
    expect(disclaimerCopy("hi").glioma).toContain("ग्लायोमा-केंद्रित");
  });
});
