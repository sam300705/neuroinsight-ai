import { describe, expect, it } from "vitest";
import { approvedResearchSamples, hasApprovedResearchSamples } from "./approvedResearchSamples";

describe("approved research sample manifest", () => {
  it("ships no MRI sample until source and redistribution evidence is recorded", () => {
    expect(approvedResearchSamples).toEqual([]);
    expect(hasApprovedResearchSamples).toBe(false);
  });
});
