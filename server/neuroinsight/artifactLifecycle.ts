import { AnyMySqlSelect } from "drizzle-orm/mysql-core";

export type OwnedArtifact = { id: number; storageKey: string; artifactType: string };
export type OwnedScan = { id: number; artifacts: OwnedArtifact[] };

export type ArtifactIntent = {
  id: string;
  scanRecordId: number;
  userId: number;
  artifactType: "report" | "grad_cam" | "segmentation_mask" | "three_dimensional";
  storageKey: string;
  displacedStorageKey: string | null;
  state: "pending" | "committed" | "cancelled";
  expectedRevision: number | null;
  cleanupComplete: number;
};

type DownloadDependencies = {
  findOwnedArtifact: (userId: number, artifactId: number) => Promise<OwnedArtifact | undefined>;
  createSignedUrl: (storageKey: string) => Promise<string>;
};

type DeleteOneDependencies = {
  findOwnedScan: (userId: number, scanId: string, tx?: any) => Promise<OwnedScan | undefined>;
  deleteStoredArtifact: (storageKey: string) => Promise<void>;

  deleteArtifactMetadata: (scanRecordId: number, tx?: any) => Promise<void>;
  deleteScanMetadata: (scanRecordId: number, tx?: any) => Promise<void>;
  runInTransaction: <T>(callback: (tx: any) => Promise<T>) => Promise<T>;
  markIntentsCancelled: (scanRecordId: number, tx: any) => Promise<void>;
  listIntentsForScan: (scanRecordId: number) => Promise<ArtifactIntent[]>;
  markIntentCleanupComplete: (intentId: string) => Promise<void>;
};

type DeleteAllDependencies = {
  listOwnedScans: (userId: number) => Promise<OwnedScan[]>;
  deleteStoredArtifact: (storageKey: string) => Promise<void>;

  deleteArtifactMetadata: (scanRecordId: number, tx?: any) => Promise<void>;
  deleteScanMetadata: (scanRecordId: number, tx?: any) => Promise<void>;
  runInTransaction: <T>(callback: (tx: any) => Promise<T>) => Promise<T>;
  markIntentsCancelled: (scanRecordId: number, tx: any) => Promise<void>;
  listIntentsForScan: (scanRecordId: number) => Promise<ArtifactIntent[]>;
  markIntentCleanupComplete: (intentId: string) => Promise<void>;
};

type IntentReconciliationDependencies = {
  listPendingOrUncleanedIntents: (limit: number) => Promise<ArtifactIntent[]>;
  findArtifactByIntent: (intent: ArtifactIntent, tx: any) => Promise<{ storageKey: string } | undefined>;
  markIntentCommitted: (intentId: string, tx: any) => Promise<void>;
  markIntentCancelled: (intentId: string, tx: any) => Promise<void>;
  deleteStoredArtifact: (storageKey: string) => Promise<void>;
  markIntentCleanupComplete: (intentId: string) => Promise<void>;
  incrementIntentRetry: (intentId: string) => Promise<void>;
  runInTransaction: <T>(callback: (tx: any) => Promise<T>) => Promise<T>;
};

export function assertOwnedStorageKey(userId: number, storageKey: string) {
  if (!storageKey.startsWith(`neuroinsight/${userId}/`)) {
    throw new Error("Artifact storage key is outside the authenticated user scope.");
  }
}

async function deletePhysicalArtifacts(userId: number, artifacts: OwnedArtifact[], deleteStoredArtifact: (storageKey: string) => Promise<void>) {
  for (const artifact of artifacts) {
    if (artifact.storageKey.startsWith("pending:")) continue;
    assertOwnedStorageKey(userId, artifact.storageKey);
    await deleteStoredArtifact(artifact.storageKey);
  }
}

async function cleanupIntentArtifacts(userId: number, intents: ArtifactIntent[], deleteStoredArtifact: (storageKey: string) => Promise<void>, markComplete: (id: string) => Promise<void>) {
  for (const intent of intents) {
    if (intent.cleanupComplete) continue;
    let success = true;

    try {
      if (intent.state === "cancelled") {
        assertOwnedStorageKey(userId, intent.storageKey);
        await deleteStoredArtifact(intent.storageKey);
      } else if (intent.state === "committed" && intent.displacedStorageKey) {
        assertOwnedStorageKey(userId, intent.displacedStorageKey);
        await deleteStoredArtifact(intent.displacedStorageKey);
      }
    } catch {
      success = false;
    }

    if (success) {
      await markComplete(intent.id);
    }
  }
}

/**
 * Issues a new signed URL only after the caller's ownership-scoped lookup succeeds.
 * The signed URL is intentionally generated on demand and is never persisted in the database.
 */
export async function issueOwnedArtifactDownload(
  userId: number,
  artifactId: number,
  dependencies: DownloadDependencies,
) {
  const artifact = await dependencies.findOwnedArtifact(userId, artifactId);
  if (!artifact) throw new Error("Artifact was not found for this user.");
  if (artifact.storageKey.startsWith("pending:")) throw new Error("Artifact upload is incomplete. Please retry saving the result.");
  return { ...artifact, storageUrl: await dependencies.createSignedUrl(artifact.storageKey) };
}

/**
 * Deletes a scan and its artifacts.
 * Uses a transaction to cancel any pending intents to ensure we don't leak uploaded objects.
 */
export async function deleteOwnedScan(
  userId: number,
  scanId: string,
  dependencies: DeleteOneDependencies,
) {
  let recordId: number;
  let artifacts: OwnedArtifact[];

  const deleted = await dependencies.runInTransaction(async (tx) => {
    // Pass the tx so we can read with FOR UPDATE locks
    const record = await dependencies.findOwnedScan(userId, scanId, tx);
    if (!record) return false;
    recordId = record.id;
    artifacts = record.artifacts;

    await dependencies.markIntentsCancelled(record.id, tx);
    await dependencies.deleteArtifactMetadata(record.id, tx);
    await dependencies.deleteScanMetadata(record.id, tx);
    return true;
  });

  if (!deleted) return { deleted: false };

  // Best effort physical deletion
  try {
    await deletePhysicalArtifacts(userId, artifacts!, dependencies.deleteStoredArtifact);

    const intents = await dependencies.listIntentsForScan(recordId!);
    await cleanupIntentArtifacts(userId, intents, dependencies.deleteStoredArtifact, dependencies.markIntentCleanupComplete);
  } catch {
    // Errors are swallowed; reconciliation will retry intents. Active artifacts without intents might leak but they are rare.
  }

  return { deleted: true };
}

/** Physically removes each owned scan's artifacts before its metadata. */
export async function deleteAllOwnedScans(userId: number, dependencies: DeleteAllDependencies) {
  const records = await dependencies.listOwnedScans(userId);
  let deletedCount = 0;
  for (const record of records) {
    const deleted = await dependencies.runInTransaction(async (tx) => {
      await dependencies.markIntentsCancelled(record.id, tx);
      await dependencies.deleteArtifactMetadata(record.id, tx);
      await dependencies.deleteScanMetadata(record.id, tx);
      return true;
    });

    if (deleted) {
      deletedCount++;
      try {
        await deletePhysicalArtifacts(userId, record.artifacts, dependencies.deleteStoredArtifact);
        const intents = await dependencies.listIntentsForScan(record.id);
        await cleanupIntentArtifacts(userId, intents, dependencies.deleteStoredArtifact, dependencies.markIntentCleanupComplete);
      } catch {
        // Continue
      }
    }
  }
  return { deletedCount };
}

/**
 * Reconciles unresolved intents (ambiguous commits or pending uploads).
 */
export async function reconcileIntents(dependencies: IntentReconciliationDependencies) {
  const intents = await dependencies.listPendingOrUncleanedIntents(50);

  for (const intent of intents) {
    try {
      let state = intent.state;

      // If it's still pending, it might be an ambiguous commit. We must lock and check.
      if (state === "pending") {
        state = await dependencies.runInTransaction(async (tx) => {
          // findArtifactByIntent must use tx to acquire FOR UPDATE lock
          const artifact = await dependencies.findArtifactByIntent(intent, tx);
          if (artifact && artifact.storageKey === intent.storageKey) {
            // It committed!
            await dependencies.markIntentCommitted(intent.id, tx);
            return "committed";
          } else {
            // It didn't commit, cancel it to prevent late finalization.
            await dependencies.markIntentCancelled(intent.id, tx);
            return "cancelled";
          }
        });
      }

      // Now perform cleanup based on the determined state outside of transaction
      if (state === "cancelled") {
        await dependencies.deleteStoredArtifact(intent.storageKey);
        await dependencies.markIntentCleanupComplete(intent.id);
      } else if (state === "committed" && intent.displacedStorageKey) {
        await dependencies.deleteStoredArtifact(intent.displacedStorageKey);
        await dependencies.markIntentCleanupComplete(intent.id);
      } else {
        await dependencies.markIntentCleanupComplete(intent.id);
      }
    } catch (err) {
      await dependencies.incrementIntentRetry(intent.id);
    }
  }
}
