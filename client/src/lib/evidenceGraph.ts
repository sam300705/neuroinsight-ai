export type EvidenceGraphNode = {
  id: string;
  label: string;
  kind: "data" | "experiment" | "calibration" | "runtime" | "release" | "provenance" | "gate";
  state: "demonstrated" | "conditional" | "not_established";
  detail: string;
};

export type EvidenceGraphEdge = {
  from: string;
  to: string;
  relation: string;
};

export const EVIDENCE_GRAPH_VERSION = "neuroinsight-evidence-graph/2026-09-11" as const;

export const evidenceGraph = Object.freeze({
  version: EVIDENCE_GRAPH_VERSION,
  nodes: Object.freeze<EvidenceGraphNode[]>([
    { id: "dataset-v7", label: "BDNeuro-MRI v7", kind: "data", state: "demonstrated", detail: "Audited source for the current fixed image-level EXP-005 evidence." },
    { id: "split-exp005", label: "EXP-005 fixed split", kind: "data", state: "demonstrated", detail: "Same-dataset image-level validation/test evidence; not patient-disjoint." },
    { id: "exp005", label: "EXP-005", kind: "experiment", state: "demonstrated", detail: "ResNet50 head-only four-class academic classifier." },
    { id: "cal-exp005", label: "EXP-005 calibration", kind: "calibration", state: "demonstrated", detail: "Validation-only temperature scaling and abstention threshold." },
    { id: "onnx-runtime", label: "Checksum-verified ONNX runtime", kind: "runtime", state: "demonstrated", detail: "Runtime checks model, metadata, calibration artifacts, and fixed tensor contract before serving." },
    { id: "release-manifest", label: "Release Truth Manifest", kind: "release", state: "demonstrated", detail: "Machine-readable Mode A/Mode B, model, evidence, migration, and artifact-policy declarations." },
    { id: "evidence-ledger", label: "Evidence Ledger", kind: "provenance", state: "demonstrated", detail: "Separates demonstrated, conditional, and not-established evidence without an aggregate trust score." },
    { id: "research-passport", label: "Research Passport v1", kind: "provenance", state: "demonstrated", detail: "Portable result provenance with local SHA-256 source matching and explicit non-claims." },
    { id: "passport-attestation", label: "Ed25519 Passport Attestation", kind: "provenance", state: "conditional", detail: "Cryptographic primitive and tamper tests exist; release activation still requires trusted analysis-receipt binding and trusted public-key distribution." },
    { id: "mode-b-gate", label: "Mode B release gate", kind: "gate", state: "not_established", detail: "No accepted full-volume case-disjoint segmentation model/evaluation is released." },
  ]),
  edges: Object.freeze<EvidenceGraphEdge[]>([
    { from: "dataset-v7", to: "split-exp005", relation: "audited into" },
    { from: "split-exp005", to: "exp005", relation: "evaluates" },
    { from: "exp005", to: "cal-exp005", relation: "calibrated by" },
    { from: "exp005", to: "onnx-runtime", relation: "exported to" },
    { from: "cal-exp005", to: "onnx-runtime", relation: "configures" },
    { from: "onnx-runtime", to: "release-manifest", relation: "declared by" },
    { from: "release-manifest", to: "evidence-ledger", relation: "constrains" },
    { from: "release-manifest", to: "research-passport", relation: "describes release context for" },
    { from: "research-passport", to: "passport-attestation", relation: "future trusted binding" },
    { from: "mode-b-gate", to: "release-manifest", relation: "keeps unavailable in" },
  ]),
});

export function validateEvidenceGraph() {
  const ids = new Set(evidenceGraph.nodes.map(node => node.id));
  const errors: string[] = [];
  if (ids.size !== evidenceGraph.nodes.length) errors.push("Evidence graph node ids must be unique.");
  for (const edge of evidenceGraph.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) errors.push(`Evidence graph edge references an unknown node: ${edge.from} -> ${edge.to}`);
  }
  const modeBGate = evidenceGraph.nodes.find(node => node.id === "mode-b-gate");
  if (!modeBGate || modeBGate.state !== "not_established") errors.push("Mode B release gate must remain not_established.");
  const attestation = evidenceGraph.nodes.find(node => node.id === "passport-attestation");
  if (!attestation || attestation.state !== "conditional") errors.push("Passport attestation must remain conditional until trusted receipt binding is deployed.");
  return { ok: errors.length === 0, errors } as const;
}

export function exportEvidenceGraph() {
  return {
    schema_version: EVIDENCE_GRAPH_VERSION,
    aggregate_trust_score: null,
    note: "Graph connectivity describes provenance relationships; it does not convert missing evidence into demonstrated evidence.",
    nodes: evidenceGraph.nodes,
    edges: evidenceGraph.edges,
  };
}
