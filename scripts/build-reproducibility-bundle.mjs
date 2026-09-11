import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const outputPath = resolve(root, process.argv[2] || "release/reproducibility-bundle.generated.json");
const artifactPaths = [
  "release/release-manifest.template.json",
  "release/operational-slos.json",
  "models/EXP-005/model-manifest.json",
  "research/robustness-protocol.json",
  "EXPERIMENTS.md",
  "docs/MODEL_CARD.md",
  "docs/CAPABILITY_MANIFEST.md",
  "docs/ARCHITECTURE.md",
  "docs/ARTIFACT_LIFECYCLE_RECOVERY.md",
  "client/src/lib/evidenceLedger.ts",
  "client/src/lib/evidenceGraph.ts",
  "client/src/lib/researchPassport.ts",
  "client/src/lib/researchPassportV2.ts",
  "client/src/lib/experimentComparison.ts",
  "client/src/lib/reliabilityMetrics.ts",
  "client/src/lib/robustnessEvidence.ts",
  "server/neuroinsight/passportAttestation.ts",
  "drizzle/meta/_journal.json",
  "pnpm-lock.yaml",
  "backend/uv.lock"
];

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const sourceCommit = process.env.GITHUB_HEAD_SHA?.trim() || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const artifacts = artifactPaths.map(path => {
  const absolute = resolve(root, path);
  const bytes = readFileSync(absolute);
  return {
    path,
    bytes: statSync(absolute).size,
    sha256: sha256(bytes),
  };
});

const releaseManifest = JSON.parse(readFileSync(resolve(root, "release/release-manifest.template.json"), "utf8"));
const modelManifest = JSON.parse(readFileSync(resolve(root, "models/EXP-005/model-manifest.json"), "utf8"));

const bundle = {
  schema_version: "neuroinsight-reproducibility-bundle/v1",
  generated_at: new Date().toISOString(),
  source_commit: sourceCommit,
  scope: "academic_non_clinical_research",
  release: {
    schema_version: releaseManifest.schema_version,
    mode_a_experiment_id: releaseManifest.mode_a.experiment_id,
    model_version: releaseManifest.mode_a.model_version,
    mode_b_status: releaseManifest.mode_b.status,
    evidence_ledger_version: releaseManifest.evidence_ledger_version,
    evidence_graph_version: releaseManifest.evidence_graph_version,
    research_passport_versions: releaseManifest.research_passport_versions,
    database_migration_head: releaseManifest.database_migration_head,
    robustness_release_state: releaseManifest.robustness_research.release_state,
    operational_slo_status: releaseManifest.operational_slos.status,
  },
  model: {
    manifest_schema: modelManifest.schema_version,
    experiment_id: modelManifest.experiment_id,
    model_version: modelManifest.model_version,
    evidence_scope: modelManifest.evaluation.scope,
    external_validation: modelManifest.evaluation.external_validation,
    patient_case_disjoint: modelManifest.evaluation.patient_case_disjoint,
  },
  artifacts,
  root_digest_sha256: sha256(Buffer.from(artifacts.map(item => `${item.sha256}  ${item.path}`).join("\n"), "utf8")),
  excluded_by_design: [
    "raw MRI images",
    "patient data",
    "private keys",
    "API tokens",
    "signed storage URLs",
    "deployment secrets",
    "model binary files"
  ],
  claims: {
    clinical_validation: false,
    external_validation: false,
    patient_level_performance: false,
    mode_b_available: false,
    robustness_established: false,
    slo_attainment_certified: false,
    aggregate_trust_score: null
  },
  note: "This bundle fingerprints declared source evidence and dependency locks. It supports reproducibility/audit comparison but is not a SLSA attestation, clinical validation record, robustness certification, SLO certification, or proof that external services were configured correctly."
};

writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
console.log(`Generated ${outputPath}`);
console.log(`Bundle root SHA-256: ${bundle.root_digest_sha256}`);
