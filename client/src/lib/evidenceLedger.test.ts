import { describe, expect, it } from "vitest";
import { evidenceLedger, evidenceStateCounts, exportEvidenceLedger } from "./evidenceLedger";

describe("claim-to-evidence ledger", () => {
  it("uses unique identifiers and all three evidence states", () => {
    const ids = evidenceLedger.map(entry => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const counts = evidenceStateCounts();
    expect(counts.demonstrated).toBeGreaterThan(0);
    expect(counts.conditional).toBeGreaterThan(0);
    expect(counts.not_established).toBeGreaterThan(0);
  });

  it("never marks unsupported clinical/generalization claims as demonstrated", () => {
    const protectedIds = [
      "external-testing",
      "patient-case-split",
      "ood-detection",
      "conformal-coverage",
      "subgroup-fairness",
      "prospective-testing",
      "mode-b-segmentation",
    ];
    for (const id of protectedIds) {
      expect(evidenceLedger.find(entry => entry.id === id)?.state).toBe("not_established");
    }
  });

  it("exports no aggregate trust score", () => {
    const exported = exportEvidenceLedger();
    expect(exported.aggregate_trust_score).toBeNull();
    expect(exported.schema_version).toBe("neuroinsight-evidence-ledger/2026-09-11");
  });
});
