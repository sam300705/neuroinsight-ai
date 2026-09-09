import { describe, expect, it, vi } from "vitest";
import { deleteAllOwnedScans, deleteOwnedScan, issueOwnedArtifactDownload, reconcileIntents, ArtifactIntent } from "./artifactLifecycle";

describe("artifact lifecycle ownership boundaries", () => {
  it("does not sign a download for an artifact outside the authenticated user scope", async () => {
    let signerCalls = 0;
    await expect(issueOwnedArtifactDownload(2, 7, {
      findOwnedArtifact: async () => undefined,
      createSignedUrl: async () => { signerCalls += 1; return "https://example.invalid/signed"; },
    })).rejects.toThrow("Artifact was not found for this user.");
    expect(signerCalls).toBe(0);
  });

  it("returns a fresh signed URL only after an owned artifact lookup", async () => {
    const signedKeys: string[] = [];
    const result = await issueOwnedArtifactDownload(1, 7, {
      findOwnedArtifact: async (userId, artifactId) => userId === 1 && artifactId === 7 ? { id: 7, artifactType: "report", storageKey: "neuroinsight/1/scan/report.pdf" } : undefined,
      createSignedUrl: async key => { signedKeys.push(key); return `https://example.invalid/fresh/${signedKeys.length}`; },
    });
    expect(result.storageUrl).toBe("https://example.invalid/fresh/1");
    expect(signedKeys).toEqual(["neuroinsight/1/scan/report.pdf"]);
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

  it("cancels intents and deletes metadata transactionally before best-effort storage cleanup", async () => {
    const deps = dummyDependencies();
    deps.findOwnedScan.mockResolvedValue({ id: 14, artifacts: [{ id: 8, artifactType: "report", storageKey: "neuroinsight/1/scan-1/report.pdf" }] });
    deps.listIntentsForScan.mockResolvedValue([
      { id: "intent-1", scanRecordId: 14, userId: 1, artifactType: "report", storageKey: "neuroinsight/1/scan-1/attempt.pdf", displacedStorageKey: "neuroinsight/1/scan-1/report.pdf", state: "cancelled", expectedRevision: null, cleanupComplete: 0 },
      { id: "intent-2", scanRecordId: null, userId: 1, artifactType: "report", storageKey: "neuroinsight/1/scan-1/report.pdf", displacedStorageKey: null, state: "cancelled", expectedRevision: null, cleanupComplete: 0 }
    ]);
    deps.createCleanupIntentsForArtifacts.mockResolvedValue([{
      id: "intent-2", scanRecordId: null, userId: 1, artifactType: "report", storageKey: "neuroinsight/1/scan-1/report.pdf", displacedStorageKey: null, state: "cancelled", expectedRevision: null, cleanupComplete: 0
    }]);

    const result = await deleteOwnedScan(1, "scan-1", deps as any);

    expect(result).toEqual({ deleted: true });
    expect(deps.markIntentsCancelled).toHaveBeenCalledWith(14, expect.anything());
    expect(deps.createCleanupIntentsForArtifacts).toHaveBeenCalledWith(1, [{ id: 8, artifactType: "report", storageKey: "neuroinsight/1/scan-1/report.pdf" }], expect.anything());
    expect(deps.deleteArtifactMetadata).toHaveBeenCalledWith(14, expect.anything());
    expect(deps.deleteScanMetadata).toHaveBeenCalledWith(14, expect.anything());

    // We expect both the attempted unreferenced artifact and the actual artifact to be cleaned up
    expect(deps.deleteStoredArtifact).toHaveBeenCalledWith("neuroinsight/1/scan-1/attempt.pdf");
    expect(deps.deleteStoredArtifact).toHaveBeenCalledWith("neuroinsight/1/scan-1/report.pdf");
  });

  it("swallows storage failures during deletion without rolling back the transaction", async () => {
    const deps = dummyDependencies();
    deps.findOwnedScan.mockResolvedValue({ id: 14, artifacts: [{ id: 8, artifactType: "report", storageKey: "neuroinsight/1/scan-1/report.pdf" }] });
    deps.deleteStoredArtifact.mockRejectedValue(new Error("storage unavailable"));

    const result = await deleteOwnedScan(1, "scan-1", deps as any);

    expect(result).toEqual({ deleted: true });
    expect(deps.deleteArtifactMetadata).toHaveBeenCalled();
    expect(deps.deleteScanMetadata).toHaveBeenCalled();
  });
});

describe("deleteAllOwnedScans", () => {
  const dummyDependencies = () => ({
    listOwnedScans: vi.fn(),
    deleteStoredArtifact: vi.fn().mockResolvedValue(undefined),
    deleteArtifactMetadata: vi.fn(),
    deleteScanMetadata: vi.fn(),
    runInTransaction: vi.fn().mockImplementation(async (cb) => cb({} as any)),
    markIntentsCancelled: vi.fn(),
    listIntentsForScan: vi.fn().mockResolvedValue([]),
    markIntentCleanupComplete: vi.fn(),
    createCleanupIntentsForArtifacts: vi.fn().mockResolvedValue([]),
  });

  it("purges only the current user's listed metadata records", async () => {
    const deps = dummyDependencies();
    deps.listOwnedScans.mockResolvedValue([
      { id: 4, artifacts: [{ id: 11, artifactType: "grad_cam", storageKey: "neuroinsight/3/scan-a/grad_cam.png" }] },
      { id: 9, artifacts: [] },
    ]);
    deps.listIntentsForScan.mockResolvedValue([{
      id: "intent-1", scanRecordId: 4, userId: 3, artifactType: "grad_cam", storageKey: "neuroinsight/3/scan-a/grad_cam.png", displacedStorageKey: null, state: "cancelled", expectedRevision: null, cleanupComplete: 0
    }]);

    const result = await deleteAllOwnedScans(3, deps as any);

    expect(result).toEqual({ deletedCount: 2 });
    expect(deps.markIntentsCancelled).toHaveBeenCalledTimes(2);
    expect(deps.createCleanupIntentsForArtifacts).toHaveBeenCalledTimes(2);
    expect(deps.deleteArtifactMetadata).toHaveBeenCalledTimes(2);
    expect(deps.deleteScanMetadata).toHaveBeenCalledTimes(2);
    expect(deps.deleteStoredArtifact).toHaveBeenCalledWith("neuroinsight/3/scan-a/grad_cam.png");
  });
});

describe("reconcileIntents", () => {
  const dummyDependencies = () => ({
    listPendingOrUncleanedIntents: vi.fn(),
    findArtifactByIntent: vi.fn(),
    markIntentCommitted: vi.fn(),
    markIntentCancelled: vi.fn(),
    deleteStoredArtifact: vi.fn().mockResolvedValue(undefined),
    markIntentCleanupComplete: vi.fn(),
    incrementIntentRetry: vi.fn(),
    runInTransaction: vi.fn().mockImplementation(async (cb) => cb({} as any)),
  });

  it("reconciles a pending intent that actually committed and locks the artifact record", async () => {
    const deps = dummyDependencies();
    const intent: ArtifactIntent = { id: "1", scanRecordId: 1, userId: 1, artifactType: "report", storageKey: "attempt.pdf", displacedStorageKey: "old.pdf", state: "pending", expectedRevision: null, cleanupComplete: 0 };
    deps.listPendingOrUncleanedIntents.mockResolvedValue([intent]);
    deps.findArtifactByIntent.mockResolvedValue({ storageKey: "attempt.pdf" });

    await reconcileIntents(deps as any);

    // Ensure findArtifactByIntent is passed the transaction
    expect(deps.findArtifactByIntent).toHaveBeenCalledWith(intent, expect.anything());
    // Ensure markIntentCommitted is passed the transaction
    expect(deps.markIntentCommitted).toHaveBeenCalledWith("1", expect.anything());
    // Since it committed and had a displacedStorageKey, we clean up the displaced key outside the transaction
    expect(deps.deleteStoredArtifact).toHaveBeenCalledWith("old.pdf");
    expect(deps.markIntentCleanupComplete).toHaveBeenCalledWith("1");
  });

  it("reconciles a pending intent that never committed", async () => {
    const deps = dummyDependencies();
    const intent: ArtifactIntent = { id: "2", scanRecordId: 1, userId: 1, artifactType: "report", storageKey: "attempt.pdf", displacedStorageKey: "old.pdf", state: "pending", expectedRevision: null, cleanupComplete: 0 };
    deps.listPendingOrUncleanedIntents.mockResolvedValue([intent]);
    deps.findArtifactByIntent.mockResolvedValue({ storageKey: "old.pdf" }); // active artifact is not the attempt

    await reconcileIntents(deps as any);

    // Ensure markIntentCancelled is passed the transaction
    expect(deps.markIntentCancelled).toHaveBeenCalledWith("2", expect.anything());
    // Since it was cancelled, clean up the attempted upload outside the transaction
    expect(deps.deleteStoredArtifact).toHaveBeenCalledWith("attempt.pdf");
    expect(deps.markIntentCleanupComplete).toHaveBeenCalledWith("2");
  });

  it("reconciles an already committed intent that just needs cleanup (no transaction needed)", async () => {
    const deps = dummyDependencies();
    const intent: ArtifactIntent = { id: "3", scanRecordId: 1, userId: 1, artifactType: "report", storageKey: "attempt.pdf", displacedStorageKey: "old.pdf", state: "committed", expectedRevision: null, cleanupComplete: 0 };
    deps.listPendingOrUncleanedIntents.mockResolvedValue([intent]);

    await reconcileIntents(deps as any);

    expect(deps.runInTransaction).not.toHaveBeenCalled();
    expect(deps.deleteStoredArtifact).toHaveBeenCalledWith("old.pdf");
    expect(deps.markIntentCleanupComplete).toHaveBeenCalledWith("3");
  });

  it("increments retry counter if cleanup fails", async () => {
    const deps = dummyDependencies();
    const intent: ArtifactIntent = { id: "3", scanRecordId: 1, userId: 1, artifactType: "report", storageKey: "attempt.pdf", displacedStorageKey: "old.pdf", state: "committed", expectedRevision: null, cleanupComplete: 0 };
    deps.listPendingOrUncleanedIntents.mockResolvedValue([intent]);
    deps.deleteStoredArtifact.mockRejectedValue(new Error("Storage unavailable"));

    await reconcileIntents(deps as any);

    expect(deps.deleteStoredArtifact).toHaveBeenCalledWith("old.pdf");
    expect(deps.markIntentCleanupComplete).not.toHaveBeenCalled();
    expect(deps.incrementIntentRetry).toHaveBeenCalledWith("3");
  });
});
