import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { copyFor } from "../client/src/contexts/pageCopy";

const projectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf-8");

describe("canonical capability status", () => {
  it("keeps the public Mode A and Mode B states aligned across the manifest, handover, and UI copy", () => {
    const manifest = projectFile("docs/CAPABILITY_MANIFEST.md");
    const handover = projectFile("docs/PUBLIC_HANDOVER.md");
    const openGates = projectFile("docs/OPEN_GATES.md");

    expect(manifest).toContain("| Mode A classification | **Available**");
    expect(manifest).toContain("| Mode B segmentation | **Unavailable by design**");
    expect(handover).toContain("Mode A is a real experimental 2D, four-class brain-MRI image classifier.");
    expect(openGates).toContain("Mode A classifier is live");
    expect(copyFor("en").home.modelDetail).toContain("Mode B segmentation remains unavailable");
  });

  it("retains the exact non-diagnostic safety notice in the canonical status record", () => {
    expect(projectFile("docs/CAPABILITY_MANIFEST.md")).toContain(
      "This system is not a medical diagnosis and must not replace a qualified radiologist."
    );
  });
});
