export type EvidenceState = "demonstrated" | "conditional" | "not_established";

export type EvidenceLedgerEntry = {
  id: string;
  category: "model" | "data" | "uncertainty" | "provenance" | "explainability" | "operations" | "clinical";
  title: string;
  state: EvidenceState;
  evidence: string;
  boundary: string;
};

export const EVIDENCE_LEDGER_VERSION = "neuroinsight-evidence-ledger/2026-09-11" as const;

export const evidenceLedger: readonly EvidenceLedgerEntry[] = Object.freeze([
  {
    id: "mode-a-runtime",
    category: "model",
    title: "Mode A experimental classifier runtime",
    state: "demonstrated",
    evidence: "EXP-005 exposes a checksum/metadata-verified ONNX inference path and fail-closed unavailable state.",
    boundary: "2D four-class academic image classification only; not a diagnostic model.",
  },
  {
    id: "internal-image-testing",
    category: "data",
    title: "Held-out image-level testing",
    state: "demonstrated",
    evidence: "EXP-005 records a fixed same-dataset image-level validation partition and a held-out 889-image test partition.",
    boundary: "This is not patient-level, institutional, geographic, temporal, or external testing.",
  },
  {
    id: "calibration",
    category: "uncertainty",
    title: "Validation-only score calibration",
    state: "demonstrated",
    evidence: "Temperature scaling, ECE/Brier evidence, and a validation-derived 0.55 abstention threshold are recorded for EXP-005.",
    boundary: "The model score remains an experimental model score, not a medical probability.",
  },
  {
    id: "selective-abstention",
    category: "uncertainty",
    title: "Selective abstention",
    state: "demonstrated",
    evidence: "Scores below the declared EXP-005 threshold enter low-confidence status with manual-review guidance.",
    boundary: "Abstention does not establish safe performance under distribution shift.",
  },
  {
    id: "input-fingerprint",
    category: "provenance",
    title: "Local source fingerprint",
    state: "demonstrated",
    evidence: "The dashboard can compute SHA-256 from the selected source bytes and carry it in a versioned Research Passport.",
    boundary: "A hash supports provenance matching; it is not anonymization, authorization, or a digital signature.",
  },
  {
    id: "passport-verifier",
    category: "provenance",
    title: "Offline Research Passport source verification",
    state: "demonstrated",
    evidence: "The verifier parses Passport v1 and compares source SHA-256 locally without fetch/XHR; CI exercises match and mismatch paths.",
    boundary: "Local hash verification does not cryptographically verify a server HMAC receipt.",
  },
  {
    id: "same-input-repeatability",
    category: "operations",
    title: "Same-input repeatability evidence",
    state: "conditional",
    evidence: "A current in-memory source can be rerun three times to compare class, status, calibration state, score drift, and Grad-CAM determinism.",
    boundary: "This is request repeatability only, not robustness to scanner/protocol/noise/institutional shift.",
  },
  {
    id: "gradcam",
    category: "explainability",
    title: "Classifier attribution",
    state: "conditional",
    evidence: "Grad-CAM is emitted when the configured runtime can produce the attribution artifact and can be checked for same-input determinism.",
    boundary: "Grad-CAM is not a segmentation mask, tumor boundary, causal explanation, or proof of model correctness.",
  },
  {
    id: "signed-analysis-receipt",
    category: "provenance",
    title: "Server analysis receipt",
    state: "conditional",
    evidence: "The backend can issue a bounded HMAC integrity receipt when ANALYSIS_RECEIPT_SECRET is configured.",
    boundary: "Presence depends on deployment configuration; the browser Passport verifier does not possess the server secret.",
  },
  {
    id: "external-testing",
    category: "clinical",
    title: "External testing",
    state: "not_established",
    evidence: "No independent external institutional cohort has been accepted as release evidence.",
    boundary: "Do not describe same-dataset held-out testing as external validation.",
  },
  {
    id: "patient-case-split",
    category: "data",
    title: "Patient/case-disjoint evaluation",
    state: "not_established",
    evidence: "The currently documented EXP-005 release evidence is image-level and contains no patient identifiers for a defensible case-disjoint split.",
    boundary: "No patient-level performance claim is permitted from this evidence.",
  },
  {
    id: "ood-detection",
    category: "uncertainty",
    title: "Validated out-of-distribution detection",
    state: "not_established",
    evidence: "No evaluated OOD detector or declared shifted benchmark is part of the current release evidence.",
    boundary: "Do not substitute ad-hoc image statistics or entropy thresholds for validated OOD evidence.",
  },
  {
    id: "conformal-coverage",
    category: "uncertainty",
    title: "Conformal coverage guarantee",
    state: "not_established",
    evidence: "No independent conformal calibration protocol and empirical coverage artifact are declared.",
    boundary: "No coverage guarantee is claimed.",
  },
  {
    id: "subgroup-fairness",
    category: "clinical",
    title: "Subgroup / fairness evaluation",
    state: "not_established",
    evidence: "The current release evidence does not contain lawful metadata adequate for defensible subgroup performance analysis.",
    boundary: "No demographic fairness claim is made.",
  },
  {
    id: "prospective-testing",
    category: "clinical",
    title: "Prospective workflow testing",
    state: "not_established",
    evidence: "No prospective clinical workflow study is part of this project.",
    boundary: "The application remains an academic non-clinical research workspace.",
  },
  {
    id: "mode-b-segmentation",
    category: "model",
    title: "Mode B full-volume segmentation",
    state: "not_established",
    evidence: "Only bounded smoke research exists; no accepted full-volume release artifact/evaluation is configured.",
    boundary: "The production API intentionally reports segmentation unavailable and returns no tumor area/volume.",
  },
]);

export function evidenceStateCounts(entries: readonly EvidenceLedgerEntry[] = evidenceLedger) {
  return entries.reduce(
    (counts, entry) => {
      counts[entry.state] += 1;
      return counts;
    },
    { demonstrated: 0, conditional: 0, not_established: 0 } satisfies Record<EvidenceState, number>,
  );
}

export function exportEvidenceLedger() {
  return {
    schema_version: EVIDENCE_LEDGER_VERSION,
    generated_from: "declared_release_evidence",
    aggregate_trust_score: null,
    note: "No aggregate trust score is produced because strong evidence in one dimension must not hide missing evidence in another.",
    entries: evidenceLedger,
  };
}
