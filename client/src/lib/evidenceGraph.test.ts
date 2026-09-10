import { describe, expect, it } from "vitest";
import { evidenceGraph, exportEvidenceGraph, validateEvidenceGraph } from "./evidenceGraph";

describe("evidence graph", () => {
  it("keeps all edges attached to declared evidence nodes", () => {
    expect(validateEvidenceGraph()).toEqual({ ok: true, errors: [] });
  });

  it("keeps Mode B and public-key passport attestation evidence-gated", () => {
    expect(evidenceGraph.nodes.find(node => node.id === "mode-b-gate")?.state).toBe("not_established");
    expect(evidenceGraph.nodes.find(node => node.id === "passport-attestation")?.state).toBe("conditional");
  });

  it("does not emit an aggregate trust score", () => {
    const exported = exportEvidenceGraph();
    expect(exported.aggregate_trust_score).toBeNull();
    expect(exported.nodes.length).toBeGreaterThan(5);
    expect(exported.edges.length).toBeGreaterThan(5);
  });
});
