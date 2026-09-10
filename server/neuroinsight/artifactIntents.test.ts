import { describe, expect, it } from "vitest";
import { assertOwnedStorageKey } from "./artifactLifecycle";

describe("artifact intent storage scope invariant", () => {
  it("accepts keys rooted in the recorded user's namespace", () => {
    expect(() => assertOwnedStorageKey(7, "neuroinsight/7/scan/report.pdf")).not.toThrow();
  });

  it("rejects another user's namespace and invalid user identifiers", () => {
    expect(() => assertOwnedStorageKey(7, "neuroinsight/8/scan/report.pdf")).toThrow(/outside/);
    expect(() => assertOwnedStorageKey(0, "neuroinsight/0/scan/report.pdf")).toThrow(/outside/);
  });
});
