import { AnyMySqlSelect } from "drizzle-orm/mysql-core";
import { MySqlTransaction } from "drizzle-orm/mysql-core";
import { ExtractTablesWithRelations } from "drizzle-orm";

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
  findArtifactByIntent: (intent: ArtifactIntent, tx: DbTx) => Promise<{ storageKey: string } | undefined>;
  markIntentCommitted: (intentId: string, tx: DbTx) => Promise<void>;
  markIntentCancelled: (intentId: string, tx: DbTx) => Promise<void>;
  deleteStoredArtifact: (storageKey: string) => Promise<void>;
  markIntentCleanupComplete: (intentId: string) => Promise<void>;
  incrementIntentRetry: (intentId: string) => Promise<void>;
  runInTransaction: <T>(callback: (tx: DbTx) => Promise<T>) => Promise<T>;
};

export function assertOwnedStorageKey(userId: number, storageKey: string) {
  if (!storageKey.startsWith(`neuroinsight/${userId}/`)) {
    throw new Error("Artifact storage key is outside the authenticated user scope.");
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

export async function deleteOwnedScan(
  userId: number,
  scanId: string,
  dependencies: DeleteOneDependencies,
) {
  let recordId: number;
  let allIntents: ArtifactIntent[] = [];

  const deleted = await dependencies.runInTransaction(async (tx) => {
    const record = await dependencies.findOwnedScan(userId, scanId, tx);
    if (!record) return false;
    recordId = record.id;

    await dependencies.createCleanupIntentsForArtifacts(userId, record.artifacts, tx);
    await dependencies.markIntentsCancelled(record.id, tx);
    await dependencies.deleteArtifactMetadata(record.id, tx);
    await dependencies.deleteScanMetadata(record.id, tx);

    allIntents = await dependencies.listIntentsForScan(record.id);
    return true;
  });

  if (!deleted) return { deleted: false };

  try {
    await cleanupIntentArtifacts(userId, allIntents, dependencies.deleteStoredArtifact, dependencies.markIntentCleanupComplete);
  } catch {
    // Errors swallowed
  }

  return { deleted: true };
}

export async function deleteAllOwnedScans(userId: number, dependencies: DeleteAllDependencies) {
  const records = await dependencies.listOwnedScans(userId);
  let deletedCount = 0;
  for (const scanRef of records) {
    let allIntents: ArtifactIntent[] = [];
    const deleted = await dependencies.runInTransaction(async (tx) => {
      const recordsFresh = await dependencies.listOwnedScans(userId);
      const record = recordsFresh.find(r => r.id === scanRef.id);
      if (!record) return false;

      await dependencies.createCleanupIntentsForArtifacts(userId, record.artifacts, tx);
      await dependencies.markIntentsCancelled(record.id, tx);
      await dependencies.deleteArtifactMetadata(record.id, tx);
      await dependencies.deleteScanMetadata(record.id, tx);

      allIntents = await dependencies.listIntentsForScan(record.id);
      return true;
    });

    if (deleted) {
      deletedCount++;
      try {
        await cleanupIntentArtifacts(userId, allIntents, dependencies.deleteStoredArtifact, dependencies.markIntentCleanupComplete);
      } catch {
        // Continue
      }
    }
  }
  return { deletedCount };
}

export async function reconcileIntents(dependencies: IntentReconciliationDependencies) {
  const intents = await dependencies.listPendingOrUncleanedIntents(50);

  for (const intent of intents) {
    try {
      let state = intent.state;

      if (state === "pending") {
        state = await dependencies.runInTransaction(async (tx) => {
          const artifact = await dependencies.findArtifactByIntent(intent, tx);
          if (artifact && artifact.storageKey === intent.storageKey) {
            await dependencies.markIntentCommitted(intent.id, tx);
            return "committed";
          } else {
            await dependencies.markIntentCancelled(intent.id, tx);
            return "cancelled";
          }
        });
      }

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
