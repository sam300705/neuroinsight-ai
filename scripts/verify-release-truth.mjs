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
const modelCard = read("docs/MODEL_CARD.md");
const capabilityManifest = read("docs/CAPABILITY_MANIFEST.md");
const evidenceLedger = read("client/src/lib/evidenceLedger.ts");
const passport = read("client/src/lib/researchPassport.ts");
const architecture = read("docs/ARCHITECTURE.md");
const artifactLifecycle = read("docs/ARTIFACT_LIFECYCLE_RECOVERY.md");
const migrationJournal = readJson("drizzle/meta/_journal.json");

expect(manifest.schema_version === "neuroinsight-release-manifest/v1", "release manifest schema must stay v1 until a deliberate migration");
expect(manifest.scope === "academic_non_clinical_research", "release scope must remain academic_non_clinical_research");
expect(manifest.mode_a?.status === "available", "Mode A must be declared available in the release source");
expect(manifest.mode_a?.experiment_id === "EXP-005", "EXP-005 must remain the declared Mode A release model unless separately promoted");
expect(manifest.mode_a?.model_version === "bdneuro-v7-resnet50-head-only-exp005", "Mode A model version drifted from the audited runtime identifier");
expect(manifest.mode_a?.held_out?.accuracy === 0.8099, "release manifest accuracy must match the accepted EXP-005 evidence");
expect(manifest.mode_a?.held_out?.macro_f1 === 0.808, "release manifest macro-F1 must match the accepted EXP-005 evidence");
expect(manifest.mode_a?.calibration?.temperature === 0.689875, "release manifest calibration temperature drifted");
expect(manifest.mode_a?.calibration?.abstention_threshold === 0.55, "release manifest abstention threshold drifted");
expect(manifest.mode_b?.status === "unavailable", "Mode B must fail closed until its separate evidence gate is met");
expect(manifest.trust_policy?.aggregate_trust_score === null, "release truth must not collapse multidimensional evidence into an aggregate trust score");
expect(manifest.database_migration_head === "0006_restore_referential_guards", "release manifest must require the corrective 0006 migration head");

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

for (const version of manifest.research_passport_versions) {
  expect(passport.includes(version), `research passport implementation does not contain declared schema ${version}`);
}

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
console.log(`Migration head: ${manifest.database_migration_head}`);
