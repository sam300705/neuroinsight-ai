import { describe, expect, it, vi } from "vitest";
import {
  ArtifactIntent,
  deleteAllOwnedScans,
  deleteOwnedScan,
  issueOwnedArtifactDownload,
  reconcileIntents,
} from "./artifactLifecycle";

const key = (name: string) => `neuroinsight/1/scan-1/${name}`;

describe("artifact lifecycle ownership boundaries", () => {
  it("does not sign a download for an artifact outside the authenticated user scope", async () => {
    const signer = vi.fn(async () => "https://example.invalid/signed");
    await expect(issueOwnedArtifactDownload(2, 7, {
      findOwnedArtifact: async () => undefined,
      createSignedUrl: signer,
    })).rejects.toThrow("Artifact was not found for this user.");
    expect(signer).not.toHaveBeenCalled();
  });

  it("returns a fresh signed URL only for a key inside the authenticated user namespace", async () => {
    const signer = vi.fn(async () => "https://example.invalid/fresh");
    const result = await issueOwnedArtifactDownload(1, 7, {
      findOwnedArtifact: async () => ({ id: 7, artifactType: "report", storageKey: key("report.pdf") }),
      createSignedUrl: signer,
    });
    expect(result.storageUrl).toBe("https://example.invalid/fresh");
    expect(signer).toHaveBeenCalledWith(key("report.pdf"));
  });

  it("rejects an owned metadata row whose storage key escaped the user's namespace", async () => {
    const signer = vi.fn(async () => "https://example.invalid/should-not-run");
    await expect(issueOwnedArtifactDownload(1, 7, {
      findOwnedArtifact: async () => ({ id: 7, artifactType: "report", storageKey: "neuroinsight/2/scan/report.pdf" }),
      createSignedUrl: signer,
    })).rejects.toThrow("outside the authenticated user scope");
    expect(signer).not.toHaveBeenCalled();
  });

  it("does not sign an incomplete legacy pending artifact", async () => {
    await expect(issueOwnedArtifactDownload(1, 7, {
      findOwnedArtifact: async () => ({ id: 7, artifactType: "report", storageKey: "pending:legacy" }),
      createSignedUrl: async () => "https://example.invalid/should-not-be-called",
    })).rejects.toThrow("upload is incomplete");
  });
});

describe("deleteOwnedScan", () => {
  const dummyDependencies = () => ({
    findOwnedScan: vi.fn(),
    deleteStoredArtifact: vi.fn().mockResolvedValue(undefined),
    deleteArtifactMetadata: vi.fn(),
    deleteScanMetadata: vi.fn(),
    runInTransaction: vi.fn().mockImplementation(async (cb) => cb({} as any)),
    markIntentsCancelled: vi.fn(),
    listIntentsForScan: vi.fn().mockResolvedValue([]),
    markIntentCleanupComplete: vi.fn(),
    createCleanupIntentsForArtifacts: vi.fn().mockResolvedValue([]),
  });

  it("does not delete metadata when the scan is not owned by the authenticated user", async () => {
    const deps = dummyDependencies();
    deps.findOwnedScan.mockResolvedValue(undefined);

    const result = await deleteOwnedScan(2, "scan-1", deps as any);
    expect(result).toEqual({ deleted: false });
    expect(deps.deleteArtifactMetadata).not.toHaveBeenCalled();
    expect(deps.deleteScanMetadata).not.toHaveBeenCalled();
  });

  it("records durable cleanup before metadata deletion and immediately deletes the known active object", async () => {
    const deps = dummyDependencies();
    deps.findOwnedScan.mockResolvedValue({
      id: 14,
      artifacts: [{ id: 8, artifactType: "report", storageKey: key("report.pdf") }],
    });
    deps.createCleanupIntentsForArtifacts.mockResolvedValue([{
      id: "cleanup-1",
      scanRecordId: null,
      userId: 1,
      artifactType: "report",
      storageKey: key("report.pdf"),
      displacedStorageKey: null,
      state: "cancelled",
      expectedRevision: null,
      cleanupComplete: 0,
    }]);

    const result = await deleteOwnedScan(1, "scan-1", deps as any);

    expect(result).toEqual({ deleted: true });
    expect(deps.createCleanupIntentsForArtifacts).toHaveBeenCalledWith(
      1,
      [{ id: 8, artifactType: "report", storageKey: key("report.pdf") }],
      expect.anything(),
    );
    expect(deps.markIntentsCancelled).toHaveBeenCalledWith(14, expect.anything());
    expect(deps.deleteArtifactMetadata).toHaveBeenCalledWith(14, expect.anything());
    expect(deps.deleteScanMetadata).toHaveBeenCalledWith(14, expect.anything());
    expect(deps.deleteStoredArtifact).toHaveBeenCalledWith(key("report.pdf"));
    expect(deps.markIntentCleanupComplete).toHaveBeenCalledWith("cleanup-1");
    expect(deps.listIntentsForScan).not.toHaveBeenCalled();
  });

  it("leaves durable cleanup incomplete when provider deletion fails", async () => {
    const deps = dummyDependencies();
    deps.findOwnedScan.mockResolvedValue({ id: 14, artifacts: [{ id: 8, artifactType: "report", storageKey: key("report.pdf") }] });
    deps.createCleanupIntentsForArtifacts.mockResolvedValue([{
      id: "cleanup-1", scanRecordId: null, userId: 1, artifactType: "report",
      storageKey: key("report.pdf"), displacedStorageKey: null, state: "cancelled",
      expectedRevision: null, cleanupComplete: 0,
    }]);
    deps.deleteStoredArtifact.mockRejectedValue(new Error("storage unavailable"));

    const result = await deleteOwnedScan(1, "scan-1", deps as any);

    expect(result).toEqual({ deleted: true });
    expect(deps.markIntentCleanupComplete).not.toHaveBeenCalled();
  });
});

describe("deleteAllOwnedScans", () => {
  const dummyDependencies = () => ({
    listOwnedScans: vi.fn(),
    findOwnedScanById: vi.fn(),
    deleteStoredArtifact: vi.fn().mockResolvedValue(undefined),
    deleteArtifactMetadata: vi.fn(),
    deleteScanMetadata: vi.fn(),
    runInTransaction: vi.fn().mockImplementation(async (cb) => cb({} as any)),
    markIntentsCancelled: vi.fn(),
    listIntentsForScan: vi.fn().mockResolvedValue([]),
    markIntentCleanupComplete: vi.fn(),
    createCleanupIntentsForArtifacts: vi.fn().mockResolvedValue([]),
  });

  it("locks and purges only the current user's listed records with their fresh artifact pointers", async () => {
    const deps = dummyDependencies();
    const records = [
      { id: 4, artifacts: [{ id: 11, artifactType: "grad_cam", storageKey: key("stale-snapshot.png") }] },
      { id: 9, artifacts: [] },
    ];
    deps.listOwnedScans.mockResolvedValue(records);
    deps.findOwnedScanById
      .mockResolvedValueOnce({ id: 4, artifacts: [{ id: 12, artifactType: "grad_cam", storageKey: key("grad_cam.png") }] })
      .mockResolvedValueOnce({ id: 9, artifacts: [] });
    deps.createCleanupIntentsForArtifacts
      .mockResolvedValueOnce([{
        id: "cleanup-1", scanRecordId: null, userId: 1, artifactType: "grad_cam",
        storageKey: key("grad_cam.png"), displacedStorageKey: null, state: "cancelled",
        expectedRevision: null, cleanupComplete: 0,
      }])
      .mockResolvedValueOnce([]);

    const result = await deleteAllOwnedScans(1, deps as any);

    expect(result).toEqual({ deletedCount: 2 });
    expect(deps.findOwnedScanById).toHaveBeenNthCalledWith(1, 1, 4, expect.anything());
    expect(deps.findOwnedScanById).toHaveBeenNthCalledWith(2, 1, 9, expect.anything());
    expect(deps.createCleanupIntentsForArtifacts).toHaveBeenNthCalledWith(
      1,
      1,
      [{ id: 12, artifactType: "grad_cam", storageKey: key("grad_cam.png") }],
      expect.anything(),
    );
    expect(deps.markIntentsCancelled).toHaveBeenCalledTimes(2);
    expect(deps.deleteArtifactMetadata).toHaveBeenCalledTimes(2);
    expect(deps.deleteScanMetadata).toHaveBeenCalledTimes(2);
    expect(deps.deleteStoredArtifact).toHaveBeenCalledWith(key("grad_cam.png"));
    expect(deps.deleteStoredArtifact).not.toHaveBeenCalledWith(key("stale-snapshot.png"));
  });
});

describe("reconcileIntents", () => {
  const dummyDependencies = () => ({
    listPendingOrUncleanedIntents: vi.fn(),
    lockIntentForReconciliation: vi.fn(),
    findArtifactByIntent: vi.fn(),
    markIntentCommitted: vi.fn(),
    markIntentCancelled: vi.fn(),
    deleteStoredArtifact: vi.fn().mockResolvedValue(undefined),
    markIntentCleanupComplete: vi.fn(),
    incrementIntentRetry: vi.fn(),
    runInTransaction: vi.fn().mockImplementation(async (cb) => cb({} as any)),
  });

  const intent = (overrides: Partial<ArtifactIntent> = {}): ArtifactIntent => ({
    id: "intent-1",
    scanRecordId: 1,
    userId: 1,
    artifactType: "report",
    storageKey: key("attempt.pdf"),
    displacedStorageKey: key("old.pdf"),
    state: "pending",
    expectedRevision: null,
    cleanupComplete: 0,
    ...overrides,
  });

  it("locks and reconciles a stale pending intent that actually committed", async () => {
    const deps = dummyDependencies();
    const pending = intent();
    deps.listPendingOrUncleanedIntents.mockResolvedValue([pending]);
    deps.lockIntentForReconciliation.mockResolvedValue(pending);
    deps.findArtifactByIntent.mockResolvedValue({ storageKey: pending.storageKey });

    const stats = await reconcileIntents(deps as any, 17);

    expect(deps.listPendingOrUncleanedIntents).toHaveBeenCalledWith(17);
    expect(deps.lockIntentForReconciliation).toHaveBeenCalledWith(pending, expect.anything());
    expect(deps.findArtifactByIntent).toHaveBeenCalledWith(pending, expect.anything());
    expect(deps.markIntentCommitted).toHaveBeenCalledWith(pending.id, expect.anything());
    expect(deps.deleteStoredArtifact).toHaveBeenCalledWith(key("old.pdf"));
    expect(deps.markIntentCleanupComplete).toHaveBeenCalledWith(pending.id);
    expect(stats).toMatchObject({ processed: 1, transitionedCommitted: 1, cleanupCompleted: 1, retries: 0 });
  });

  it("does not overwrite a concurrent finalization observed after acquiring locks", async () => {
    const deps = dummyDependencies();
    const pending = intent();
    const committed = intent({ state: "committed" });
    deps.listPendingOrUncleanedIntents.mockResolvedValue([pending]);
    deps.lockIntentForReconciliation.mockResolvedValue(committed);

    await reconcileIntents(deps as any);

    expect(deps.findArtifactByIntent).not.toHaveBeenCalled();
    expect(deps.markIntentCancelled).not.toHaveBeenCalled();
    expect(deps.markIntentCommitted).not.toHaveBeenCalled();
    expect(deps.deleteStoredArtifact).toHaveBeenCalledWith(key("old.pdf"));
  });

  it("cancels and cleans a stale pending attempt that never became active", async () => {
    const deps = dummyDependencies();
    const pending = intent();
    deps.listPendingOrUncleanedIntents.mockResolvedValue([pending]);
    deps.lockIntentForReconciliation.mockResolvedValue(pending);
    deps.findArtifactByIntent.mockResolvedValue({ storageKey: key("old.pdf") });

    const stats = await reconcileIntents(deps as any);

    expect(deps.markIntentCancelled).toHaveBeenCalledWith(pending.id, expect.anything());
    expect(deps.deleteStoredArtifact).toHaveBeenCalledWith(key("attempt.pdf"));
    expect(stats.transitionedCancelled).toBe(1);
  });

  it("cleans an already committed displaced object without a transaction", async () => {
    const deps = dummyDependencies();
    const committed = intent({ state: "committed" });
    deps.listPendingOrUncleanedIntents.mockResolvedValue([committed]);

    await reconcileIntents(deps as any);

    expect(deps.runInTransaction).not.toHaveBeenCalled();
    expect(deps.deleteStoredArtifact).toHaveBeenCalledWith(key("old.pdf"));
    expect(deps.markIntentCleanupComplete).toHaveBeenCalledWith(committed.id);
  });

  it("never deletes the active key when displaced and current keys are identical", async () => {
    const deps = dummyDependencies();
    const committed = intent({ state: "committed", displacedStorageKey: key("attempt.pdf") });
    deps.listPendingOrUncleanedIntents.mockResolvedValue([committed]);

    const stats = await reconcileIntents(deps as any);

    expect(deps.deleteStoredArtifact).not.toHaveBeenCalled();
    expect(deps.markIntentCleanupComplete).toHaveBeenCalledWith(committed.id);
    expect(stats.cleanupCompleted).toBe(1);
  });

  it("refuses cleanup keys outside the recorded user's namespace", async () => {
    const deps = dummyDependencies();
    const cancelled = intent({
      state: "cancelled",
      storageKey: "neuroinsight/999/scan-1/attempt.pdf",
      displacedStorageKey: null,
    });
    deps.listPendingOrUncleanedIntents.mockResolvedValue([cancelled]);

    const stats = await reconcileIntents(deps as any);

    expect(deps.deleteStoredArtifact).not.toHaveBeenCalled();
    expect(deps.markIntentCleanupComplete).not.toHaveBeenCalled();
    expect(deps.incrementIntentRetry).toHaveBeenCalledWith(cancelled.id);
    expect(stats.retries).toBe(1);
  });

  it("increments retry bookkeeping when physical cleanup fails", async () => {
    const deps = dummyDependencies();
    const committed = intent({ state: "committed" });
    deps.listPendingOrUncleanedIntents.mockResolvedValue([committed]);
    deps.deleteStoredArtifact.mockRejectedValue(new Error("Storage unavailable"));

    const stats = await reconcileIntents(deps as any);

    expect(deps.markIntentCleanupComplete).not.toHaveBeenCalled();
    expect(deps.incrementIntentRetry).toHaveBeenCalledWith(committed.id);
    expect(stats.retries).toBe(1);
  });
});
