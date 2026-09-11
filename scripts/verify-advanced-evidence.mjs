import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const manifest = readJson("release/release-manifest.template.json");
const protocol = readJson("research/robustness-protocol.json");
const slos = readJson("release/operational-slos.json");
const robustness = read("client/src/lib/robustnessEvidence.ts");
const bundle = read("scripts/build-reproducibility-bundle.mjs");
const comparison = read("client/src/lib/experimentComparison.ts");
const fastApi = read("backend/neuroinsight_api/app.py");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(protocol.schema_version === manifest.robustness_research?.protocol_schema, "robustness protocol schema differs from release manifest");
expect(protocol.status === "protocol_only_not_release_evidence", "robustness protocol must not be represented as accepted release evidence");
expect(protocol.release_state === "not_established", "robustness release state must remain not_established until executed evidence is accepted");
expect(Array.isArray(protocol.perturbations) && protocol.perturbations.length >= 4, "robustness protocol must declare bounded perturbations before execution");
expect(Array.isArray(protocol.forbidden_shortcuts) && protocol.forbidden_shortcuts.some(item => item.includes("aggregate robustness")), "robustness protocol must explicitly forbid an aggregate robustness score");
expect(robustness.includes(manifest.robustness_research?.evidence_schema), "perturbation evidence implementation schema differs from release manifest");
expect(robustness.includes("aggregate_robustness_score: null"), "perturbation evidence must not emit an aggregate robustness score");
expect(robustness.includes("robustnessClaimEstablished: false"), "descriptive perturbation evidence must not establish robustness automatically");
expect(robustness.includes("oodDetectionEstablished: false"), "perturbation evidence must not masquerade as OOD detection");

expect(bundle.includes(manifest.reproducibility_bundle?.schema_version), "reproducibility bundle generator schema differs from release manifest");
expect(bundle.includes('"backend/uv.lock"') && bundle.includes('"pnpm-lock.yaml"'), "reproducibility bundle must fingerprint both dependency locks");
expect(bundle.includes('"models/EXP-005/model-manifest.json"'), "reproducibility bundle must fingerprint the active model manifest");
expect(bundle.includes('"release/release-manifest.template.json"'), "reproducibility bundle must fingerprint the release truth source");
expect(bundle.includes('"raw MRI images"') && bundle.includes('"private keys"'), "reproducibility bundle must explicitly exclude raw images and private keys");
expect(manifest.reproducibility_bundle?.slsa_attestation_claimed === false, "source evidence bundle must not be mislabeled as a SLSA attestation");

expect(comparison.includes(manifest.experiment_comparison?.schema_version), "experiment comparison schema differs from release manifest");
expect(comparison.includes("aggregate_model_score: null"), "experiment comparison must not hide evidence dimensions behind an aggregate model score");
expect(manifest.experiment_comparison?.automatic_promotion === false, "release manifest must prohibit automatic model promotion");

expect(slos.schema_version === manifest.operational_slos?.schema_version, "operational SLO schema differs from release manifest");
expect(slos.status === manifest.operational_slos?.status, "operational SLO status differs from release manifest");
expect(slos.telemetry_policy?.opentelemetry_export === "not_configured", "OpenTelemetry export must not be represented as active before a reviewed destination exists");
expect(Array.isArray(slos.telemetry_policy?.forbidden_dimensions) && slos.telemetry_policy.forbidden_dimensions.includes("raw_image_bytes"), "telemetry policy must prohibit raw imaging bytes");
expect(slos.telemetry_policy?.forbidden_dimensions?.includes("provider_secret"), "telemetry policy must prohibit provider secrets");
expect(slos.targets?.every(target => target.state === "target_only"), "SLOs must remain targets until measured over the declared environment/window");
for (const field of ['"event": "request_completed"', '"duration_ms"', '"request_id"', '"status": response.status_code']) {
  expect(fastApi.includes(field), `FastAPI structured operational event is missing required field: ${field}`);
}
expect(fastApi.includes("Cache-Control") && fastApi.includes("no-store"), "inference responses must retain no-store operational privacy headers");

if (failures.length) {
  console.error("Advanced evidence verification failed:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Advanced evidence verification passed.");
console.log(`Robustness: ${manifest.robustness_research.status} / ${manifest.robustness_research.release_state}`);
console.log(`Reproducibility bundle: ${manifest.reproducibility_bundle.status}`);
console.log(`Experiment promotion: ${manifest.experiment_comparison.current_decision}; automatic=${manifest.experiment_comparison.automatic_promotion}`);
console.log(`Operational SLOs: ${manifest.operational_slos.status}; OTEL=${manifest.operational_slos.opentelemetry_export}`);
