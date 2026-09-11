import type { InferenceAnalysisResponse } from "@/lib/inferenceApi";
import type { ResearchPassport } from "@/lib/researchPassport";

export const RESEARCH_PASSPORT_V2_SCHEMA = "neuroinsight-research-passport/v2" as const;
export const RELEASE_MANIFEST_SCHEMA = "neuroinsight-release-manifest/v1" as const;
export const EVIDENCE_GRAPH_VERSION = "neuroinsight-evidence-graph/2026-09-11" as const;
export const EVIDENCE_LEDGER_VERSION = "neuroinsight-evidence-ledger/2026-09-11" as const;

const SHA256_HEX = /^[a-f0-9]{64}$/;

export type ResearchPassportV2 = {
  schema_version: typeof RESEARCH_PASSPORT_V2_SCHEMA;
  generated_at: string;
  scope: "academic_non_clinical_research";
  payload: ResearchPassport;
  release_context: {
    release_manifest_schema: typeof RELEASE_MANIFEST_SCHEMA;
    release_manifest_sha256: string | null;
    evidence_ledger_version: typeof EVIDENCE_LEDGER_VERSION;
    evidence_graph_version: typeof EVIDENCE_GRAPH_VERSION;
    model_version: string;
    mode_a_experiment_id: "EXP-005";
    mode_b_status: "unavailable";
  };
  integrity: {
    payload_sha256: string;
    analysis_receipt_sha256: string | null;
    public_key_attestation: null;
    public_key_attestation_status: "conditional_not_issued";
  };
  explicit_non_claims: string[];
};

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => stableJson(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

export async function sha256Text(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto SHA-256 is unavailable in this runtime.");
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256CanonicalJson(value: unknown): Promise<string> {
  return sha256Text(stableJson(value));
}

export async function buildResearchPassportV2(input: {
  passportV1: ResearchPassport;
  analysis: InferenceAnalysisResponse;
  releaseManifestSha256?: string | null;
  generatedAt?: string;
}): Promise<ResearchPassportV2> {
  const releaseManifestSha256 = input.releaseManifestSha256 ?? null;
  if (releaseManifestSha256 !== null && !SHA256_HEX.test(releaseManifestSha256)) {
    throw new Error("releaseManifestSha256 must be a lowercase SHA-256 hex digest when supplied.");
  }
  if (input.passportV1.analysis.request_id !== input.analysis.request_id) {
    throw new Error("Passport v1 and analysis request identifiers must match.");
  }
  if (input.passportV1.analysis.scan_id !== input.analysis.scan_id) {
    throw new Error("Passport v1 and analysis scan identifiers must match.");
  }
  if (input.passportV1.analysis.model_version !== input.analysis.model_version) {
    throw new Error("Passport v1 and analysis model versions must match.");
  }

  const payloadSha256 = await sha256CanonicalJson(input.passportV1);
  const receiptSha256 = input.analysis.analysis_receipt
    ? await sha256Text(input.analysis.analysis_receipt)
    : null;

  return {
    schema_version: RESEARCH_PASSPORT_V2_SCHEMA,
    generated_at: input.generatedAt ?? new Date().toISOString(),
    scope: "academic_non_clinical_research",
    payload: input.passportV1,
    release_context: {
      release_manifest_schema: RELEASE_MANIFEST_SCHEMA,
      release_manifest_sha256: releaseManifestSha256,
      evidence_ledger_version: EVIDENCE_LEDGER_VERSION,
      evidence_graph_version: EVIDENCE_GRAPH_VERSION,
      model_version: input.analysis.model_version,
      mode_a_experiment_id: "EXP-005",
      mode_b_status: "unavailable",
    },
    integrity: {
      payload_sha256: payloadSha256,
      analysis_receipt_sha256: receiptSha256,
      public_key_attestation: null,
      public_key_attestation_status: "conditional_not_issued",
    },
    explicit_non_claims: [
      "Passport v2 hashes support integrity and provenance matching; they are not clinical validation.",
      "No public-key attestation is claimed until a trusted server receipt binding and public-key distribution path are deployed.",
      "The embedded EXP-005 evidence remains same-dataset image-level research evidence only.",
      "Mode B remains unavailable and no segmentation, physical area, or volume is established by this passport.",
    ],
  };
}

export async function verifyResearchPassportV2Integrity(passport: ResearchPassportV2) {
  if (passport.schema_version !== RESEARCH_PASSPORT_V2_SCHEMA) {
    return { ok: false as const, reason: "unsupported_schema" as const };
  }
  if (!SHA256_HEX.test(passport.integrity.payload_sha256)) {
    return { ok: false as const, reason: "invalid_payload_digest" as const };
  }
  if (
    passport.integrity.analysis_receipt_sha256 !== null &&
    !SHA256_HEX.test(passport.integrity.analysis_receipt_sha256)
  ) {
    return { ok: false as const, reason: "invalid_receipt_digest" as const };
  }
  const actual = await sha256CanonicalJson(passport.payload);
  return actual === passport.integrity.payload_sha256
    ? { ok: true as const, payloadSha256: actual }
    : { ok: false as const, reason: "payload_digest_mismatch" as const, actualPayloadSha256: actual };
}
