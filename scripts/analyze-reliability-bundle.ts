import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { summarizeReliability, type LabeledConfidence } from "../client/src/lib/reliabilityMetrics";

const [, , inputArg, outputArg] = process.argv;
if (!inputArg) {
  console.error("Usage: pnpm research:reliability <labeled-confidence.json> [output.json]");
  process.exit(2);
}

const inputPath = resolve(process.cwd(), inputArg);
if (statSync(inputPath).size > 5 * 1024 * 1024) {
  throw new Error("Reliability evidence bundle exceeds the 5 MB research-tool limit.");
}

const parsed: unknown = JSON.parse(readFileSync(inputPath, "utf8"));
if (!Array.isArray(parsed) || parsed.length < 2 || parsed.length > 1_000_000) {
  throw new Error("Reliability evidence must be a JSON array containing between 2 and 1,000,000 labeled samples.");
}

const samples: LabeledConfidence[] = parsed.map((value, index) => {
  if (!value || typeof value !== "object") throw new Error(`Sample ${index} must be an object.`);
  const record = value as Record<string, unknown>;
  if (typeof record.confidence !== "number" || typeof record.correct !== "boolean") {
    throw new Error(`Sample ${index} must contain numeric confidence and boolean correct fields.`);
  }
  return { confidence: record.confidence, correct: record.correct };
});

const report = {
  schema_version: "neuroinsight-reliability-evidence/v1",
  generated_at: new Date().toISOString(),
  input_semantics: "top_label_confidence_plus_correctness_only",
  ...summarizeReliability(samples),
  warnings: [
    "This tool analyzes labeled research-evaluation evidence only.",
    "Top-label Brier evidence is not the multiclass Brier score because full class-probability vectors are not supplied.",
    "Risk-coverage evidence does not establish safety under distribution shift.",
    "No clinical, diagnostic, patient-level, external-validation, or conformal-coverage claim is produced.",
  ],
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outputArg) {
  const outputPath = resolve(process.cwd(), outputArg);
  writeFileSync(outputPath, serialized, "utf8");
  console.log(`Wrote reliability evidence to ${outputPath}`);
} else {
  process.stdout.write(serialized);
}
