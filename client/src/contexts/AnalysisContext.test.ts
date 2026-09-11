import { describe, expect, it, vi } from "vitest";
import { clearLegacyPersistedAnalysis } from "./AnalysisContext";

describe("analysis browser privacy", () => {
  it("removes analysis data persisted by older dashboard releases", () => {
    const removeItem = vi.fn();

    clearLegacyPersistedAnalysis({ removeItem });

    expect(removeItem).toHaveBeenCalledOnce();
    expect(removeItem).toHaveBeenCalledWith("neuroinsight-current-analysis");
  });

  it("does not crash when browser storage is blocked", () => {
    expect(() => clearLegacyPersistedAnalysis({ removeItem: () => { throw new Error("blocked"); } })).not.toThrow();
  });
});
