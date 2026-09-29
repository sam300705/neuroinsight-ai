import { describe, expect, it, vi } from "vitest";
import { reconcileIntents, deleteOwnedScan, ArtifactIntent } from "./artifactLifecycle";

describe("artifact concurrency and ambiguous commit scenarios", () => {
  it("resolves ambiguous commit where registration transaction succeeded but client disconnected", async () => {
    const pendingIntent: ArtifactIntent = {
      id: "intent-ambiguous-1",
      scanRecordId: 42,
      userId: 1,
      artifactType: "report",
      storageKey: "neuroinsight/1/scan42/report_intent-ambiguous-1_abc.pdf",
      displacedStorageKey: "neuroinsight/1/scan42/old_report.pdf",
      state: "pending",
      expectedRevision: null,
      cleanupComplete: 0,
    };

    const deletedStorageKeys: string[] = [];
    const committedIntents: string[] = [];
    const completedIntents: string[] = [];

    await reconcileIntents({
      listPendingOrUncleanedIntents: async () => [pendingIntent],
      findArtifactByIntent: async (intent, _tx) => {
        // Active artifact in scan_artifacts DOES match the intent's storageKey
        return { storageKey: intent.storageKey };
      },
      markIntentCommitted: async (intentId, _tx) => {
        committedIntents.push(intentId);
      },
      markIntentCancelled: async () => {},
      deleteStoredArtifact: async (key) => {
        deletedStorageKeys.push(key);
      },
      markIntentCleanupComplete: async (intentId) => {
        completedIntents.push(intentId);
      },
      incrementIntentRetry: async () => {},
      runInTransaction: async (cb) => cb({} as any),
    });

    expect(committedIntents).toEqual(["intent-ambiguous-1"]);
    // Displaced storage key from the replacement is cleaned up
    expect(deletedStorageKeys).toEqual(["neuroinsight/1/scan42/old_report.pdf"]);
    expect(completedIntents).toEqual(["intent-ambiguous-1"]);
  });

  it("handles concurrent scan deletion racing with artifact upload finalization", async () => {
    const activeArtifacts = [
      { id: 101, storageKey: "neuroinsight/1/scan100/report.pdf", artifactType: "report" },
    ];

    const createdCleanupIntents: any[] = [];
    const storageDeletions: string[] = [];

    const result = await deleteOwnedScan(1, "scan100", {
      findOwnedScan: async (_userId, _scanId, _tx) => ({
        id: 100,
        artifacts: activeArtifacts,
      }),
      deleteStoredArtifact: async (key) => {
        storageDeletions.push(key);
      },
      deleteArtifactMetadata: async () => {},
      deleteScanMetadata: async () => {},
      runInTransaction: async (cb) => cb({} as any),
      markIntentsCancelled: async () => {},
      listIntentsForScan: async () => [
        {
          id: "intent-pending-upload",
          scanRecordId: 100,
          userId: 1,
          artifactType: "grad_cam",
          storageKey: "neuroinsight/1/scan100/grad_cam_attempt.png",
          displacedStorageKey: null,
          state: "cancelled",
          expectedRevision: null,
          cleanupComplete: 0,
        },
      ],
      markIntentCleanupComplete: async () => {},
      createCleanupIntentsForArtifacts: async (userId, artifacts, _tx) => {
        const intents = artifacts.map((art) => ({
          id: `cleanup-${art.id}`,
          scanRecordId: null,
          userId,
          artifactType: art.artifactType as any,
          storageKey: art.storageKey,
          displacedStorageKey: null,
          state: "cancelled" as const,
          expectedRevision: null,
          cleanupComplete: 0,
        }));
        createdCleanupIntents.push(...intents);
        return intents;
      },
    });

    expect(result.deleted).toBe(true);
    // Both active artifact and pending in-flight attempt are scheduled for physical storage deletion
    expect(storageDeletions).toContain("neuroinsight/1/scan100/report.pdf");
    expect(storageDeletions).toContain("neuroinsight/1/scan100/grad_cam_attempt.png");
  });
});
