import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const templatePath = resolve(root, "release/release-manifest.template.json");
const packagePath = resolve(root, "package.json");
const outputPath = resolve(root, process.argv[2] || "release/release-manifest.generated.json");

const template = JSON.parse(readFileSync(templatePath, "utf8"));
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));

function gitHead() {
  const explicit = process.env.GITHUB_HEAD_SHA?.trim();
  if (explicit) return explicit;
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

const manifest = {
  ...template,
  source_commit: gitHead(),
  generated_at: new Date().toISOString(),
  package_version: pkg.version,
};

writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated ${outputPath}`);
console.log(`Release source commit: ${manifest.source_commit}`);
