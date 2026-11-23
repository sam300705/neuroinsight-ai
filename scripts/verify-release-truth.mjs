import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const manifest = readJson("release/release-manifest.template.json");
const modelRegistry = readJson("models/EXP-005/model-manifest.json");
const experiments = read("EXPERIMENTS.md");
const modelCard = read("docs/MODEL_CARD.md");
const capabilityManifest = read("docs/CAPABILITY_MANIFEST.md");
const evidenceLedger = read("client/src/lib/evidenceLedger.ts");
const evidenceGraph = read("client/src/lib/evidenceGraph.ts");
const passportV1 = read("client/src/lib/researchPassport.ts");
const passportV2 = read("client/src/lib/researchPassportV2.ts");
const passportAttestation = read("server/neuroinsight/passportAttestation.ts");
const experimentComparison = read("client/src/lib/experimentComparison.ts");
const reliabilityMetrics = read("client/src/lib/reliabilityMetrics.ts");
const reliabilityCli = read("scripts/analyze-reliability-bundle.ts");
const architecture = read("docs/ARCHITECTURE.md");
const artifactLifecycle = read("docs/ARTIFACT_LIFECYCLE_RECOVERY.md");
const migrationJournal = readJson("drizzle/meta/_journal.json");

expect(manifest.schema_version === "neuroinsight-release-manifest/v1", "release manifest schema must stay v1 until a deliberate migration");
expect(manifest.scope === "academic_non_clinical_research", "release scope must remain academic_non_clinical_research");
const archived = manifest.historical_mode_a?.["EXP-005"];
const activeModel = readJson("backend/neuroinsight_api/v32_artifacts.json");
expect(manifest.mode_a?.status === "requires_verified_worker", "Mode A must require the verified v3.2 worker");
expect(manifest.mode_a?.model_version === "neuroinsight-ai-v3.2" && activeModel.model_version === manifest.mode_a.model_version, "Current Mode A model identity drifted");
expect(manifest.mode_a?.held_out === null, "Historical held-out metrics must not be attributed to v3.2");
expect(manifest.mode_a?.calibration?.temperature === 0.605, "v3.2 must use the deployed classifier temperature");
expect(Object.keys(activeModel.folds).length === 5 && Object.keys(activeModel.files).filter(name => name.endsWith(".weights.h5")).length === 3, "v3.2 requires three classifier and five segmentation artifacts");
expect(archived?.status === "historical" && archived.held_out.accuracy === 0.8099, "Preserve the historical EXP-005 evidence boundary");
expect(manifest.mode_b?.status === "unavailable", "Mode B must fail closed until its separate evidence gate is met");
expect(manifest.trust_policy?.aggregate_trust_score === null, "release truth must not collapse multidimensional evidence into an aggregate trust score");
expect(manifest.database_migration_head === "0006_restore_referential_guards", "release manifest must require the corrective 0006 migration head");

expect(modelRegistry.experiment_id === archived.experiment_id, "model registry experiment id differs from release manifest");
expect(modelRegistry.model_version === archived.model_version, "model registry version differs from release manifest");
expect(modelRegistry.architecture === archived.architecture, "model registry architecture differs from release manifest");
expect(modelRegistry.contract?.image_size === archived.input_image_size, "model registry input size differs from release manifest");
expect(modelRegistry.evaluation?.accuracy === archived.held_out.accuracy, "model registry accuracy differs from release manifest");
expect(modelRegistry.evaluation?.macro_f1 === archived.held_out.macro_f1, "model registry macro-F1 differs from release manifest");
expect(modelRegistry.calibration?.temperature === archived.calibration.temperature, "model registry calibration temperature differs from release manifest");
expect(modelRegistry.calibration?.abstention_threshold === archived.calibration.abstention_threshold, "model registry abstention threshold differs from release manifest");
expect(modelRegistry.promotion_policy?.automatic_replacement === false, "model registry must prohibit automatic model replacement");
expect(modelRegistry.evaluation?.external_validation === false, "EXP-005 registry must not claim external validation");
expect(modelRegistry.evaluation?.patient_case_disjoint === false, "EXP-005 registry must not claim patient/case-disjoint evidence");

for (const phrase of [
  "EXP-005",
  "CAL-005",
  "test accuracy 0.8099",
  "macro F1 0.8080",
  "Temperature `0.689875`",
  "abstention threshold `0.55`",
  "ECE `0.0885 → 0.0251`",
  "top-label Brier evidence `0.279 → 0.266`",
]) {
  expect(experiments.includes(phrase), `EXPERIMENTS.md is missing canonical release evidence: ${phrase}`);
}
expect(!experiments.includes("No calibration method, calibration split, reliability analysis, expected calibration error, Brier score, or abstention threshold was calculated for the classification experiments."), "EXPERIMENTS.md contains the obsolete no-calibration claim");

for (const phrase of [
  "EXP-005",
  "Accuracy `0.8099`",
  "macro-F1 `0.8080`",
  "Mode B",
  "Unavailable",
]) {
  expect(modelCard.includes(phrase), `MODEL_CARD.md is missing canonical evidence phrase: ${phrase}`);
}

expect(capabilityManifest.includes("Mode A classification"), "capability manifest must declare Mode A classification");
expect(capabilityManifest.includes("**Available**"), "capability manifest must contain an available capability state");
expect(capabilityManifest.includes("Mode B segmentation"), "capability manifest must explicitly track Mode B");
expect(capabilityManifest.includes("**Unavailable by design**"), "capability manifest must keep Mode B unavailable by design");
expect(capabilityManifest.includes("2026-09-11"), "canonical capability manifest status date must be current with the evidence-ledger release");

expect(evidenceLedger.includes(`EVIDENCE_LEDGER_VERSION = "${manifest.evidence_ledger_version}"`), "evidence ledger version differs from release manifest");
expect(evidenceLedger.includes("aggregate_trust_score: null"), "evidence ledger export must not produce an aggregate trust score");
expect(evidenceLedger.includes('state: "not_established"'), "evidence ledger must preserve explicit not-established evidence states");

expect(evidenceGraph.includes(`EVIDENCE_GRAPH_VERSION = "${manifest.evidence_graph_version}"`), "evidence graph version differs from release manifest");
expect(evidenceGraph.includes('id: "mode-b-gate"'), "evidence graph must include the Mode B gate");
expect(evidenceGraph.includes('id: "passport-attestation"'), "evidence graph must include the passport attestation boundary");
expect(evidenceGraph.includes("aggregate_trust_score: null"), "evidence graph must not emit an aggregate trust score");

expect(passportV1.includes('schema_version: "neuroinsight-research-passport/v1"'), "Research Passport v1 implementation is missing");
expect(passportV1.includes(`temperature: ${archived.calibration.temperature}`), "Research Passport v1 calibration temperature differs from canonical release evidence");
expect(passportV1.includes(`abstentionThreshold: ${archived.calibration.abstention_threshold}`), "Research Passport v1 abstention threshold differs from canonical release evidence");
expect(passportV1.includes("eceBefore: 0.0885") && passportV1.includes("eceAfter: 0.0251"), "Research Passport v1 ECE evidence drifted");
expect(passportV1.includes("brierBefore: 0.279") && passportV1.includes("brierAfter: 0.266"), "Research Passport v1 Brier evidence drifted");

for (const version of manifest.research_passport_versions) {
  expect(passportV1.includes(version) || passportV2.includes(version), `research passport implementation does not contain declared schema ${version}`);
}
expect(manifest.passport_v2?.status === "implemented_additive", "Passport v2 must remain additive rather than silently breaking v1 verification");
expect(passportV2.includes("analysis_receipt_sha256"), "Passport v2 must bind receipt presence by digest without exposing the receipt");
expect(passportV2.includes('public_key_attestation_status: "conditional_not_issued"'), "Passport v2 must not claim an issued public-key attestation yet");
expect(passportV2.includes('mode_b_status: "unavailable"'), "Passport v2 must preserve Mode B unavailability");

expect(manifest.passport_attestation?.status === "conditional", "passport public-key attestation must remain conditional until trusted receipt binding is deployed");
expect(passportAttestation.includes(manifest.passport_attestation?.schema_version), "passport attestation implementation schema differs from release manifest");
expect(passportAttestation.includes('algorithm: "Ed25519"'), "passport attestation implementation must remain Ed25519");
expect(passportAttestation.includes("analysisReceiptSha256"), "passport attestation must bind an analysis-receipt digest before release activation");

expect(manifest.experiment_comparison?.automatic_promotion === false, "experiment comparison must prohibit automatic promotion");
expect(experimentComparison.includes(manifest.experiment_comparison?.schema_version), "experiment comparison schema differs from release manifest");
expect(experimentComparison.includes('automaticPromotionAllowed: false'), "experiment comparison implementation must prohibit automatic promotion");
expect(experimentComparison.includes('recommendation: eligible ? "eligible_for_separate_owner_review" : "retain_incumbent"'), "experiment promotion must remain a separate owner-review decision");
expect(experimentComparison.includes("heldOutAccuracy: 0.8099") && experimentComparison.includes("heldOutAccuracy: 0.751"), "experiment comparison held-out accuracy values drifted from the experiment ledger");

expect(manifest.reliability_tooling?.status === "available_as_research_tooling", "reliability tooling must be declared as research tooling, not clinical evidence");
for (const symbol of ["expectedCalibrationError", "topLabelBrierScore", "wilsonAccuracyInterval", "riskCoverageCurve"]) {
  expect(reliabilityMetrics.includes(`function ${symbol}`), `reliability metrics implementation is missing ${symbol}`);
}
expect(reliabilityCli.includes(manifest.reliability_tooling?.schema_version), "reliability CLI schema differs from release manifest");
expect(reliabilityCli.includes("No clinical, diagnostic, patient-level, external-validation, or conformal-coverage claim"), "reliability CLI must preserve the explicit non-clinical claim boundary");

expect(architecture.includes("Mode B is a disabled research roadmap, not a hidden service capability."), "architecture must keep Mode B visibly disabled");
expect(artifactLifecycle.includes("durable intent"), "artifact lifecycle documentation must describe durable-intent cleanup");
expect(artifactLifecycle.includes("outside the transaction"), "artifact lifecycle documentation must not imply provider deletion occurs inside the DB transaction");

const journalTags = (migrationJournal.entries || []).map(entry => entry.tag);
expect(journalTags.some(tag => String(tag).includes("0006_restore_referential_guards")), "Drizzle migration journal must include 0006_restore_referential_guards");

if (failures.length) {
  console.error("Release truth verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Release truth verification passed.");
console.log(`Mode A: ${manifest.mode_a.experiment_id} (${manifest.mode_a.model_version})`);
console.log(`Mode B: ${manifest.mode_b.status}`);
console.log(`Evidence ledger: ${manifest.evidence_ledger_version}`);
console.log(`Evidence graph: ${manifest.evidence_graph_version}`);
console.log(`Passport versions: ${manifest.research_passport_versions.join(", ")}`);
console.log(`Passport attestation: ${manifest.passport_attestation.status}`);
console.log(`Experiment decision: ${manifest.experiment_comparison.current_decision}`);
console.log(`Migration head: ${manifest.database_migration_head}`);
