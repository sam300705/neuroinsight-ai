import type { MySqlTransaction } from "drizzle-orm/mysql-core";

export type DbTx = MySqlTransaction<any, any, any, any>;

export type OwnedArtifact = { id: number; storageKey: string; artifactType: string };
export type OwnedScan = { id: number; artifacts: OwnedArtifact[] };

export type ArtifactIntent = {
  id: string;
  scanRecordId: number | null;
  userId: number;
  artifactType: "report" | "grad_cam" | "segmentation_mask" | "three_dimensional";
  storageKey: string;
  displacedStorageKey: string | null;
  state: "pending" | "committed" | "cancelled";
  expectedRevision: number | null;
  cleanupComplete: number;
};

export type ArtifactReconciliationStats = {
  processed: number;
  transitionedCommitted: number;
  transitionedCancelled: number;
  cleanupCompleted: number;
  retries: number;
};

type DownloadDependencies = {
  findOwnedArtifact: (userId: number, artifactId: number) => Promise<OwnedArtifact | undefined>;
  createSignedUrl: (storageKey: string) => Promise<string>;
};

type DeleteOneDependencies = {
  findOwnedScan: (userId: number, scanId: string, tx?: DbTx) => Promise<OwnedScan | undefined>;
  deleteStoredArtifact: (storageKey: string) => Promise<void>;
  deleteArtifactMetadata: (scanRecordId: number, tx?: DbTx) => Promise<void>;
  deleteScanMetadata: (scanRecordId: number, tx?: DbTx) => Promise<void>;
  runInTransaction: <T>(callback: (tx: DbTx) => Promise<T>) => Promise<T>;
  markIntentsCancelled: (scanRecordId: number, tx: DbTx) => Promise<void>;
  listIntentsForScan: (scanRecordId: number) => Promise<ArtifactIntent[]>;
  markIntentCleanupComplete: (intentId: string) => Promise<void>;
  createCleanupIntentsForArtifacts: (userId: number, artifacts: OwnedArtifact[], tx: DbTx) => Promise<ArtifactIntent[]>;
};

type DeleteAllDependencies = {
  listOwnedScans: (userId: number) => Promise<OwnedScan[]>;
  findOwnedScanById: (userId: number, recordId: number, tx: DbTx) => Promise<OwnedScan | undefined>;
  deleteStoredArtifact: (storageKey: string) => Promise<void>;
  deleteArtifactMetadata: (scanRecordId: number, tx?: DbTx) => Promise<void>;
  deleteScanMetadata: (scanRecordId: number, tx?: DbTx) => Promise<void>;
  runInTransaction: <T>(callback: (tx: DbTx) => Promise<T>) => Promise<T>;
  markIntentsCancelled: (scanRecordId: number, tx: DbTx) => Promise<void>;
  listIntentsForScan: (scanRecordId: number) => Promise<ArtifactIntent[]>;
  markIntentCleanupComplete: (intentId: string) => Promise<void>;
  createCleanupIntentsForArtifacts: (userId: number, artifacts: OwnedArtifact[], tx: DbTx) => Promise<ArtifactIntent[]>;
};

type IntentReconciliationDependencies = {
  listPendingOrUncleanedIntents: (limit: number) => Promise<ArtifactIntent[]>;
  lockIntentForReconciliation: (intent: ArtifactIntent, tx: DbTx) => Promise<ArtifactIntent | undefined>;
  findArtifactByIntent: (intent: ArtifactIntent, tx: DbTx) => Promise<{ storageKey: string } | undefined>;
  markIntentCommitted: (intentId: string, tx: DbTx) => Promise<void>;
  markIntentCancelled: (intentId: string, tx: DbTx) => Promise<void>;
  deleteStoredArtifact: (storageKey: string) => Promise<void>;
  markIntentCleanupComplete: (intentId: string) => Promise<void>;
  incrementIntentRetry: (intentId: string) => Promise<void>;
  runInTransaction: <T>(callback: (tx: DbTx) => Promise<T>) => Promise<T>;
};

export function assertOwnedStorageKey(userId: number, storageKey: string) {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !storageKey.startsWith(`neuroinsight/${userId}/`)) {
    throw new Error("Artifact storage key is outside the authenticated user scope.");
  }
}

async function cleanupKnownDeletedArtifacts(
  userId: number,
  intents: ArtifactIntent[],
  deleteStoredArtifact: (storageKey: string) => Promise<void>,
  markComplete: (id: string) => Promise<void>,
) {
  for (const intent of intents) {
    if (intent.cleanupComplete || intent.state === "pending") continue;

    try {
      if (intent.userId !== userId) {
        throw new Error("Cleanup intent does not belong to the authenticated user.");
      }

      if (intent.state === "cancelled") {
        // Only detached cleanup intents are known to represent an already-existing object.
        // Attached cancelled/pending upload intents are deliberately deferred to the recovery
        // worker so a timed-out provider PUT gets a settle grace period before physical delete.
        if (intent.scanRecordId !== null) continue;
        assertOwnedStorageKey(intent.userId, intent.storageKey);
        await deleteStoredArtifact(intent.storageKey);
      } else if (
        intent.state === "committed" &&
        intent.displacedStorageKey &&
        intent.displacedStorageKey !== intent.storageKey
      ) {
        assertOwnedStorageKey(intent.userId, intent.displacedStorageKey);
        await deleteStoredArtifact(intent.displacedStorageKey);
      }

      await markComplete(intent.id);
    } catch {
      // Durable intent remains incomplete and will be retried by reconciliation.
    }
  }
}

export async function issueOwnedArtifactDownload(
  userId: number,
  artifactId: number,
  dependencies: DownloadDependencies,
) {
  const artifact = await dependencies.findOwnedArtifact(userId, artifactId);
  if (!artifact) throw new Error("Artifact was not found for this user.");
  if (artifact.storageKey.startsWith("pending:")) {
    throw new Error("Artifact upload is incomplete. Please retry saving the result.");
  }
  assertOwnedStorageKey(userId, artifact.storageKey);
  return { ...artifact, storageUrl: await dependencies.createSignedUrl(artifact.storageKey) };
}

export async function deleteOwnedScan(
  userId: number,
  scanId: string,
  dependencies: DeleteOneDependencies,
) {
  let cleanupIntents: ArtifactIntent[] = [];

  const deleted = await dependencies.runInTransaction(async (tx) => {
    const record = await dependencies.findOwnedScan(userId, scanId, tx);
    if (!record) return false;

    cleanupIntents = await dependencies.createCleanupIntentsForArtifacts(userId, record.artifacts, tx);
    await dependencies.markIntentsCancelled(record.id, tx);
    await dependencies.deleteArtifactMetadata(record.id, tx);
    await dependencies.deleteScanMetadata(record.id, tx);
    return true;
  });

  if (!deleted) return { deleted: false };

  await cleanupKnownDeletedArtifacts(
    userId,
    cleanupIntents,
    dependencies.deleteStoredArtifact,
    dependencies.markIntentCleanupComplete,
  );

  return { deleted: true };
}

export async function deleteAllOwnedScans(userId: number, dependencies: DeleteAllDependencies) {
  const records = await dependencies.listOwnedScans(userId);
  let deletedCount = 0;

  for (const scanRef of records) {
    let cleanupIntents: ArtifactIntent[] = [];
    const deleted = await dependencies.runInTransaction(async (tx) => {
      // Re-read and lock exactly this owned scan inside the transaction. Using the normal DB
      // handle here would allow a concurrent artifact replacement to escape the cleanup snapshot.
      const record = await dependencies.findOwnedScanById(userId, scanRef.id, tx);
      if (!record) return false;

      cleanupIntents = await dependencies.createCleanupIntentsForArtifacts(userId, record.artifacts, tx);
      await dependencies.markIntentsCancelled(record.id, tx);
      await dependencies.deleteArtifactMetadata(record.id, tx);
      await dependencies.deleteScanMetadata(record.id, tx);
      return true;
    });

    if (!deleted) continue;
    deletedCount += 1;
    await cleanupKnownDeletedArtifacts(
      userId,
      cleanupIntents,
      dependencies.deleteStoredArtifact,
      dependencies.markIntentCleanupComplete,
    );
  }

  return { deletedCount };
}

export async function reconcileIntents(
  dependencies: IntentReconciliationDependencies,
  limit = 50,
): Promise<ArtifactReconciliationStats> {
  const intents = await dependencies.listPendingOrUncleanedIntents(limit);
  const stats: ArtifactReconciliationStats = {
    processed: 0,
    transitionedCommitted: 0,
    transitionedCancelled: 0,
    cleanupCompleted: 0,
    retries: 0,
  };

  for (const intent of intents) {
    stats.processed += 1;

    try {
      let currentIntent = intent;

      if (currentIntent.state === "pending") {
        const reconciled = await dependencies.runInTransaction(async (tx) => {
          // The concrete DB adapter locks the scan before the intent, matching artifact
          // finalization/deletion lock order and preventing recovery from racing a live commit.
          const lockedIntent = await dependencies.lockIntentForReconciliation(currentIntent, tx);
          if (!lockedIntent) return undefined;
          if (lockedIntent.state !== "pending") return lockedIntent;

          const artifact = await dependencies.findArtifactByIntent(lockedIntent, tx);
          if (artifact?.storageKey === lockedIntent.storageKey) {
            await dependencies.markIntentCommitted(lockedIntent.id, tx);
            return { ...lockedIntent, state: "committed" as const };
          }

          await dependencies.markIntentCancelled(lockedIntent.id, tx);
          return { ...lockedIntent, state: "cancelled" as const };
        });

        if (!reconciled) continue;
        currentIntent = reconciled;
        if (currentIntent.state === "committed") stats.transitionedCommitted += 1;
        if (currentIntent.state === "cancelled") stats.transitionedCancelled += 1;
      }

      if (currentIntent.state === "cancelled") {
        assertOwnedStorageKey(currentIntent.userId, currentIntent.storageKey);
        await dependencies.deleteStoredArtifact(currentIntent.storageKey);
      } else if (
        currentIntent.state === "committed" &&
        currentIntent.displacedStorageKey &&
        currentIntent.displacedStorageKey !== currentIntent.storageKey
      ) {
        assertOwnedStorageKey(currentIntent.userId, currentIntent.displacedStorageKey);
        await dependencies.deleteStoredArtifact(currentIntent.displacedStorageKey);
      }

      await dependencies.markIntentCleanupComplete(currentIntent.id);
      stats.cleanupCompleted += 1;
    } catch {
      stats.retries += 1;
      try {
        await dependencies.incrementIntentRetry(intent.id);
      } catch {
        // A later sweep can retry both reconciliation and retry bookkeeping.
      }
    }
  }

  return stats;
}
