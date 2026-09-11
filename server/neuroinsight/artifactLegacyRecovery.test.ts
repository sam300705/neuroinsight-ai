import { describe, expect, it, vi } from "vitest";
import { ArtifactIntent, reconcileIntents } from "./artifactLifecycle";

const intent = (overrides: Partial<ArtifactIntent> = {}): ArtifactIntent => ({
  id: "legacy-intent",
  scanRecordId: 1,
  userId: 1,
  artifactType: "report",
  storageKey: "neuroinsight/1/scan-1/current.pdf",
  displacedStorageKey: "pending:legacy-placeholder",
  state: "committed",
  expectedRevision: null,
  cleanupComplete: 0,
  ...overrides,
});

function dependenciesFor(rows: ArtifactIntent[]) {
  return {
    listPendingOrUncleanedIntents: vi.fn().mockResolvedValue(rows),
    lockIntentForReconciliation: vi.fn(),
    findArtifactByIntent: vi.fn(),
    markIntentCommitted: vi.fn(),
    markIntentCancelled: vi.fn(),
    deleteStoredArtifact: vi.fn().mockResolvedValue(undefined),
    markIntentCleanupComplete: vi.fn().mockResolvedValue(undefined),
    incrementIntentRetry: vi.fn().mockResolvedValue(undefined),
    runInTransaction: vi.fn(),
  };
}

describe("legacy artifact cleanup compatibility", () => {
  it("closes a committed intent whose displaced value is a metadata-only pending placeholder", async () => {
    const current = intent();
    const deps = dependenciesFor([current]);

    const stats = await reconcileIntents(deps as any);

    expect(deps.deleteStoredArtifact).not.toHaveBeenCalled();
    expect(deps.markIntentCleanupComplete).toHaveBeenCalledWith(current.id);
    expect(deps.incrementIntentRetry).not.toHaveBeenCalled();
    expect(stats).toMatchObject({ processed: 1, cleanupCompleted: 1, retries: 0 });
  });

  it("closes a legacy cancelled placeholder without sending it to physical storage", async () => {
    const current = intent({
      state: "cancelled",
      storageKey: "pending:legacy-placeholder",
      displacedStorageKey: null,
    });
    const deps = dependenciesFor([current]);

    const stats = await reconcileIntents(deps as any);

    expect(deps.deleteStoredArtifact).not.toHaveBeenCalled();
    expect(deps.markIntentCleanupComplete).toHaveBeenCalledWith(current.id);
    expect(stats.cleanupCompleted).toBe(1);
  });
});
