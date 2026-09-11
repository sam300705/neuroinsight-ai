import { and, asc, eq, lt, or, sql } from "drizzle-orm";
import { scanArtifactIntents, scanArtifacts, scanRecords } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { storageDelete } from "../storage";
import { ArtifactIntent, ArtifactReconciliationStats, DbTx, reconcileIntents } from "./artifactLifecycle";

export const ARTIFACT_RECONCILIATION_BATCH_SIZE = 50;
export const ARTIFACT_RECONCILIATION_INTERVAL_MS = 60_000;
// Object upload timeout is 30 seconds. A substantially longer grace period prevents a
// locally-timed-out PUT that finishes remotely from appearing after an early delete.
export const ARTIFACT_UPLOAD_SETTLE_GRACE_MS = 5 * 60_000;

export type ArtifactReconciliationBatchResult = ArtifactReconciliationStats & {
  available: boolean;
};

export function artifactReconciliationConfigured(): boolean {
  return [ENV.databaseUrl, ENV.forgeApiUrl, ENV.forgeApiKey].every(value => value.trim().length > 0);
}

function unavailableResult(): ArtifactReconciliationBatchResult {
  return {
    available: false,
    processed: 0,
    transitionedCommitted: 0,
    transitionedCancelled: 0,
    cleanupCompleted: 0,
    retries: 0,
  };
}

export async function reconcileArtifactIntentsBatch(
  requestedLimit = ARTIFACT_RECONCILIATION_BATCH_SIZE,
): Promise<ArtifactReconciliationBatchResult> {
  if (!artifactReconciliationConfigured()) return unavailableResult();

  const db = await getDb();
  if (!db) return unavailableResult();

  const limit = Math.min(ARTIFACT_RECONCILIATION_BATCH_SIZE, Math.max(1, Math.trunc(requestedLimit)));
  const staleBefore = new Date(Date.now() - ARTIFACT_UPLOAD_SETTLE_GRACE_MS);

  const stats = await reconcileIntents({
    listPendingOrUncleanedIntents: async (batchLimit) => {
      const rows = await db
        .select()
        .from(scanArtifactIntents)
        .where(or(
          and(
            eq(scanArtifactIntents.state, "pending"),
            lt(scanArtifactIntents.updatedAt, staleBefore),
          ),
          and(
            eq(scanArtifactIntents.state, "cancelled"),
            eq(scanArtifactIntents.cleanupComplete, 0),
            lt(scanArtifactIntents.updatedAt, staleBefore),
          ),
          and(
            eq(scanArtifactIntents.state, "committed"),
            eq(scanArtifactIntents.cleanupComplete, 0),
            // First cleanup attempt may happen immediately. Once it fails, retryCount is
            // incremented and updatedAt becomes a simple bounded backoff clock.
            or(
              eq(scanArtifactIntents.retryCount, 0),
              lt(scanArtifactIntents.updatedAt, staleBefore),
            ),
          ),
        ))
        .orderBy(asc(scanArtifactIntents.updatedAt))
        .limit(batchLimit);
      return rows as ArtifactIntent[];
    },
    lockIntentForReconciliation: async (snapshot, tx) => {
      // Match the write paths' lock order: scan -> intent -> artifact. This prevents
      // deadlocks and ensures a recovery sweep cannot cancel a finalization that won.
      if (snapshot.scanRecordId !== null) {
        // @ts-ignore Drizzle's MySQL builder supports FOR UPDATE at runtime.
        await (tx
          .select({ id: scanRecords.id })
          .from(scanRecords)
          .where(and(
            eq(scanRecords.id, snapshot.scanRecordId),
            eq(scanRecords.userId, snapshot.userId),
          )) as any)
          .for("update")
          .limit(1);
      }

      // @ts-ignore Drizzle's MySQL builder supports FOR UPDATE at runtime.
      const [current] = await (tx
        .select()
        .from(scanArtifactIntents)
        .where(eq(scanArtifactIntents.id, snapshot.id)) as any)
        .for("update")
        .limit(1);
      return current as ArtifactIntent | undefined;
    },
    findArtifactByIntent: async (intent, tx) => {
      if (intent.scanRecordId === null) return undefined;
      // @ts-ignore Drizzle's MySQL builder supports FOR UPDATE at runtime.
      const [artifact] = await (tx
        .select({ storageKey: scanArtifacts.storageKey })
        .from(scanArtifacts)
        .where(and(
          eq(scanArtifacts.scanRecordId, intent.scanRecordId),
          eq(scanArtifacts.artifactType, intent.artifactType),
        )) as any)
        .for("update")
        .limit(1);
      return artifact;
    },
    markIntentCommitted: async (intentId, tx) => {
      await tx.update(scanArtifactIntents)
        .set({ state: "committed" })
        .where(and(
          eq(scanArtifactIntents.id, intentId),
          eq(scanArtifactIntents.state, "pending"),
        ));
    },
    markIntentCancelled: async (intentId, tx) => {
      await tx.update(scanArtifactIntents)
        .set({ state: "cancelled" })
        .where(and(
          eq(scanArtifactIntents.id, intentId),
          eq(scanArtifactIntents.state, "pending"),
        ));
    },
    deleteStoredArtifact: storageDelete,
    markIntentCleanupComplete: async (intentId) => {
      await db.update(scanArtifactIntents)
        .set({ cleanupComplete: 1 })
        .where(eq(scanArtifactIntents.id, intentId));
    },
    incrementIntentRetry: async (intentId) => {
      await db.update(scanArtifactIntents)
        .set({ retryCount: sql`${scanArtifactIntents.retryCount} + 1` })
        .where(eq(scanArtifactIntents.id, intentId));
    },
    runInTransaction: async <T>(callback: (tx: DbTx) => Promise<T>) => db.transaction(callback),
  }, limit);

  return { available: true, ...stats };
}

type WorkerOptions = {
  intervalMs?: number;
  configured?: () => boolean;
  runBatch?: () => Promise<unknown>;
  onError?: () => void;
};

export function startArtifactReconciliationWorker(options: WorkerOptions = {}): () => void {
  const configured = options.configured ?? artifactReconciliationConfigured;
  if (!configured()) return () => undefined;

  const runBatch = options.runBatch ?? (() => reconcileArtifactIntentsBatch());
  const onError = options.onError ?? (() => console.warn("[ArtifactRecovery] reconciliation sweep failed"));
  const intervalMs = Math.max(1_000, options.intervalMs ?? ARTIFACT_RECONCILIATION_INTERVAL_MS);
  let running = false;
  let stopped = false;

  const run = async () => {
    if (stopped || running) return;
    running = true;
    try {
      await runBatch();
    } catch {
      onError();
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
