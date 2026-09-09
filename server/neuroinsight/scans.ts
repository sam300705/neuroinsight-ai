import { and, desc, eq, inArray, like, lt, sql } from "drizzle-orm";
import { scanArtifactIntents, scanArtifacts, scanRecords } from "../../drizzle/schema";
import { getDb } from "../db";
import { storageDelete, storageGetSignedUrl, storagePutStable } from "../storage";
import { artifactRegistrationSchema, measurementSchema, scanResultSchema, validateArtifactPayload, warningsSchema } from "./validation";
import { deleteAllOwnedScans, deleteOwnedScan, issueOwnedArtifactDownload, ArtifactIntent, DbTx, OwnedArtifact } from "./artifactLifecycle";
import { ACTIVE_HISTORY_MODE, historyListInputSchema } from "./historyPolicy";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import crypto from "crypto";

const historyUnavailable = (): never => {
  throw new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: "Scan history is temporarily unavailable.",
  });
};

const parseStoredJson = <T>(value: string, schema: z.ZodType<T>): T | undefined => {
  try {
    if (typeof value !== "string" || value.length > 32768) return undefined;
    const parsed = schema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

export const scansRouter = router({
  list: protectedProcedure.input(historyListInputSchema).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return historyUnavailable();
    try {
      const conditions = [eq(scanRecords.userId, ctx.user.id), eq(scanRecords.mode, ACTIVE_HISTORY_MODE), input.cursor ? lt(scanRecords.id, input.cursor) : undefined, input.predictedClass ? eq(scanRecords.predictedClass, input.predictedClass) : undefined, input.status ? eq(scanRecords.status, input.status) : undefined, input.search ? like(scanRecords.scanId, `%${input.search.replace(/[\\%_]/g, "\\$&")}%`) : undefined].filter(Boolean);
      const records = await db.select().from(scanRecords).where(and(...conditions)).orderBy(desc(scanRecords.id)).limit(input.limit + 1);
      const hasNextPage = records.length > input.limit;
      const page = hasNextPage ? records.slice(0, input.limit) : records;
      const artifacts = page.length
        ? await db.select().from(scanArtifacts).where(inArray(scanArtifacts.scanRecordId, page.map(record => record.id)))
        : [];
      let omittedCorruptRecords = 0;
      const items = page.flatMap(record => {
        const measurement = parseStoredJson(record.measurementJson, measurementSchema);
        const warnings = parseStoredJson(record.warningsJson, warningsSchema);
        const confidenceScore = record.confidenceScore === null ? null : Number(record.confidenceScore);
        const result = scanResultSchema.safeParse({
          ...record,
          confidenceScore: confidenceScore ?? undefined,
          predictedClass: record.predictedClass ?? undefined,
          uncertaintyReason: record.uncertaintyReason ?? undefined,
          calibrated: record.calibrated === 1,
          manualReviewRecommended: record.manualReviewRecommended === 1,
          measurement, warnings,
        });
        if (!result.success || ![0, 1].includes(record.calibrated) ||
            ![0, 1].includes(record.manualReviewRecommended) ||
            (record.confidenceScore !== null && String(record.confidenceScore).trim() === "") ||
            !Number.isSafeInteger(record.id) || record.id <= 0 ||
            !(record.createdAt instanceof Date) || !Number.isFinite(record.createdAt.getTime())) {
          omittedCorruptRecords += 1;
          return [];
        }
        return [{
          ...result.data,
          id: record.id,
          createdAt: record.createdAt,
          confidenceScore: result.data.confidenceScore ?? null,
          predictedClass: result.data.predictedClass ?? null,
          uncertaintyReason: result.data.uncertaintyReason ?? null,
          artifacts: artifacts
            .filter(artifact => artifact.scanRecordId === record.id && !artifact.storageKey.startsWith("pending:"))
            .map(artifact => ({ id: artifact.id, artifactType: artifact.artifactType, contentType: artifact.contentType, createdAt: artifact.createdAt })),
        }];
      });
      return {
        items,
        nextCursor: hasNextPage ? page.at(-1)?.id ?? null : null,
        omittedCorruptRecords,
      };
    } catch {
      return historyUnavailable();
    }
  }),

  saveResult: protectedProcedure.input(scanResultSchema).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Scan history database is unavailable.");
    const values = { scanId: input.scanId, userId: ctx.user.id, mode: input.mode, status: input.status, modelVersion: input.modelVersion, processingTimeMs: input.processingTimeMs, predictedClass: input.predictedClass, confidenceScore: input.confidenceScore?.toFixed(5), calibrated: input.calibrated ? 1 : 0, uncertaintyReason: input.uncertaintyReason, manualReviewRecommended: input.manualReviewRecommended ? 1 : 0, measurementJson: JSON.stringify(input.measurement), warningsJson: JSON.stringify(input.warnings) };
    const [ownedRecord] = await db.select({ id: scanRecords.id }).from(scanRecords).where(and(eq(scanRecords.userId, ctx.user.id), eq(scanRecords.scanId, input.scanId))).limit(1);
    if (ownedRecord) {
      await db.update(scanRecords).set(values).where(eq(scanRecords.id, ownedRecord.id));
    } else {
      try {
        await db.insert(scanRecords).values(values);
      } catch {
        const [concurrentlyCreatedOwnedRecord] = await db.select({ id: scanRecords.id }).from(scanRecords).where(and(eq(scanRecords.userId, ctx.user.id), eq(scanRecords.scanId, input.scanId))).limit(1);
        if (!concurrentlyCreatedOwnedRecord) throw new Error("Scan result could not be saved. Please retry.");
        await db.update(scanRecords).set(values).where(eq(scanRecords.id, concurrentlyCreatedOwnedRecord.id));
      }
    }
    return { scanId: input.scanId };
  }),

  registerArtifact: protectedProcedure.input(artifactRegistrationSchema).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Scan history database is unavailable.");

    // Validate ownership before starting
    const [record] = await db.select().from(scanRecords).where(and(eq(scanRecords.userId, ctx.user.id), eq(scanRecords.scanId, input.scanId))).limit(1);
    if (!record) throw new Error("Scan record was not found for this user.");

    const bytes = validateArtifactPayload(input.base64, input.contentType);

    const intentId = crypto.randomUUID();
    const extension = input.artifactType === "report" ? "pdf" : "png";
    const attemptSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    // Use full intentId UUID + operation ID suffix
    const attemptStorageKey = `neuroinsight/${ctx.user.id}/${input.scanId}/${input.artifactType}_${intentId}_${attemptSuffix}.${extension}`;

    await db.insert(scanArtifactIntents).values({
      id: intentId,
      scanRecordId: record.id,
      userId: ctx.user.id,
      artifactType: input.artifactType,
      storageKey: attemptStorageKey,
      displacedStorageKey: null,
      state: "pending",
      cleanupComplete: 0,
      retryCount: 0,
    });

    let uploadSuccess = false;
    let stored: { key: string; url: string } | null = null;
    try {
      stored = await storagePutStable(attemptStorageKey, bytes, input.contentType);
      if (stored.key !== attemptStorageKey) {
        throw new Error("Provider returned unexpected storage key");
      }
      uploadSuccess = true;
    } catch (error) {
      try {
        await db.update(scanArtifactIntents).set({ state: "cancelled" }).where(eq(scanArtifactIntents.id, intentId));
      } catch {
        // ignore
      }
      throw new Error("Artifact upload failed.");
    }

    if (!uploadSuccess || !stored) {
       throw new Error("Artifact upload failed.");
    }

    let transactionSuccess = false;
    let actualDisplacedKey: string | null = null;
    try {
      await db.transaction(async (tx) => {
        // @ts-ignore
        const [checkRecord] = await (tx.select({ id: scanRecords.id }).from(scanRecords).where(eq(scanRecords.id, record.id)) as any).for("update").limit(1);
        if (!checkRecord) throw new Error("Scan was deleted during upload.");

        // @ts-ignore
        const [checkIntent] = await (tx.select({ state: scanArtifactIntents.state }).from(scanArtifactIntents).where(eq(scanArtifactIntents.id, intentId)) as any).for("update").limit(1);
        if (checkIntent?.state === "cancelled") throw new Error("Upload was cancelled.");

        // Read ACTUAL current pointer under the shared lock
        // @ts-ignore
        const [existing] = await (tx.select({ storageKey: scanArtifacts.storageKey }).from(scanArtifacts).where(and(eq(scanArtifacts.scanRecordId, record.id), eq(scanArtifacts.artifactType, input.artifactType))) as any).for("update").limit(1);

        actualDisplacedKey = existing ? existing.storageKey : null;

        await tx.insert(scanArtifacts).values({
          scanRecordId: record.id,
          artifactType: input.artifactType,
          storageKey: stored!.key,
          storageUrl: "ownership-scoped-download-only",
          contentType: input.contentType
        }).onDuplicateKeyUpdate({
          set: {
            storageKey: stored!.key,
            storageUrl: "ownership-scoped-download-only",
            contentType: input.contentType
          }
        });

        await tx.update(scanArtifactIntents)
          .set({ state: "committed", displacedStorageKey: actualDisplacedKey })
          .where(eq(scanArtifactIntents.id, intentId));
      });
      transactionSuccess = true;
    } catch (error) {
      throw new Error("Failed to finalize artifact registration.");
    }

    if (transactionSuccess && actualDisplacedKey && actualDisplacedKey !== attemptStorageKey) {
       try {
         await storageDelete(actualDisplacedKey);
         await db.update(scanArtifactIntents).set({ cleanupComplete: 1 }).where(eq(scanArtifactIntents.id, intentId));
       } catch (err) {
         // ignore
       }
    }

    return { artifactType: input.artifactType, contentType: input.contentType, existing: Boolean(actualDisplacedKey), pending: false };
  }),

  getArtifactDownload: protectedProcedure.input(z.object({ artifactId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Scan history database is unavailable.");
    return issueOwnedArtifactDownload(ctx.user.id, input.artifactId, {
      findOwnedArtifact: async (userId, artifactId) => {
        const [artifact] = await db
          .select({ id: scanArtifacts.id, storageKey: scanArtifacts.storageKey, artifactType: scanArtifacts.artifactType })
          .from(scanArtifacts)
          .innerJoin(scanRecords, eq(scanArtifacts.scanRecordId, scanRecords.id))
          .where(and(eq(scanArtifacts.id, artifactId), eq(scanRecords.userId, userId)))
          .limit(1);
        return artifact;
      },
      createSignedUrl: storageGetSignedUrl,
    });
  }),

  deleteOne: protectedProcedure.input(z.object({ scanId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const db = await getDb(); if (!db) throw new Error("Scan history database is unavailable.");

    return deleteOwnedScan(ctx.user.id, input.scanId, {
      findOwnedScan: async (userId, scanId, tx) => {
        const execDb = tx || db;
        // @ts-ignore
        const record = tx ? (await (tx.select({ id: scanRecords.id }).from(scanRecords).where(and(eq(scanRecords.userId, userId), eq(scanRecords.scanId, scanId))) as any).for("update").limit(1))[0] : (await execDb.select({ id: scanRecords.id }).from(scanRecords).where(and(eq(scanRecords.userId, userId), eq(scanRecords.scanId, scanId))).limit(1))[0];
        if (!record) return undefined;
        // @ts-ignore
        const artifacts = tx ? await (tx.select({ id: scanArtifacts.id, storageKey: scanArtifacts.storageKey, artifactType: scanArtifacts.artifactType }).from(scanArtifacts).where(eq(scanArtifacts.scanRecordId, record.id)) as any).for("update") : await execDb.select({ id: scanArtifacts.id, storageKey: scanArtifacts.storageKey, artifactType: scanArtifacts.artifactType }).from(scanArtifacts).where(eq(scanArtifacts.scanRecordId, record.id));
        return { ...record, artifacts };
      },
      deleteStoredArtifact: storageDelete,
      deleteArtifactMetadata: async (recordId, tx) => {
        const execDb = tx || db;
        await execDb.delete(scanArtifacts).where(eq(scanArtifacts.scanRecordId, recordId));
      },
      deleteScanMetadata: async (recordId, tx) => {
        const execDb = tx || db;
        await execDb.delete(scanRecords).where(eq(scanRecords.id, recordId));
      },
      runInTransaction: async (callback) => {
        return await db.transaction(callback);
      },
      markIntentsCancelled: async (recordId, tx) => {
        const execDb = tx || db;
        await execDb.update(scanArtifactIntents).set({ state: "cancelled" })
          .where(and(eq(scanArtifactIntents.scanRecordId, recordId), eq(scanArtifactIntents.state, "pending")));
      },
      listIntentsForScan: async (recordId) => {
        return (await db.select().from(scanArtifactIntents).where(eq(scanArtifactIntents.scanRecordId, recordId))) as ArtifactIntent[];
      },
      markIntentCleanupComplete: async (intentId) => {
        await db.update(scanArtifactIntents).set({ cleanupComplete: 1 }).where(eq(scanArtifactIntents.id, intentId));
      },
      createCleanupIntentsForArtifacts: async (userId, artifacts, tx) => {
        const execDb = tx || db;
        const intents: ArtifactIntent[] = [];
        for (const art of artifacts) {
          if (art.storageKey.startsWith("pending:")) continue;
          const intentId = crypto.randomUUID();
          await execDb.insert(scanArtifactIntents).values({
            id: intentId,
            scanRecordId: null, // Detached so it survives scan deletion
            userId: userId,
            artifactType: art.artifactType as any,
            storageKey: art.storageKey,
            displacedStorageKey: null,
            state: "cancelled", // Legacy/Active artifacts just need to be deleted
            cleanupComplete: 0,
            retryCount: 0,
          });
          intents.push({
            id: intentId, scanRecordId: null, userId, artifactType: art.artifactType as any,
            storageKey: art.storageKey, displacedStorageKey: null, state: "cancelled", expectedRevision: null, cleanupComplete: 0
          });
        }
        return intents;
      }
    });
  }),

  deleteAll: protectedProcedure.input(z.object({ confirmation: z.literal("DELETE_ALL_RESEARCH_HISTORY") })).mutation(async ({ ctx }) => {
    const db = await getDb(); if (!db) throw new Error("Scan history database is unavailable.");

    const deps = {
      listOwnedScans: async (userId: number) => {
        const records = await db.select({ id: scanRecords.id }).from(scanRecords).where(eq(scanRecords.userId, userId));
        if (!records.length) return [];
        const artifacts = await db.select({ id: scanArtifacts.id, scanRecordId: scanArtifacts.scanRecordId, storageKey: scanArtifacts.storageKey, artifactType: scanArtifacts.artifactType }).from(scanArtifacts).where(inArray(scanArtifacts.scanRecordId, records.map(record => record.id)));
        return records.map(record => ({ ...record, artifacts: artifacts.filter(artifact => artifact.scanRecordId === record.id).map(({ scanRecordId: _scanRecordId, ...artifact }) => artifact) }));
      },
      deleteStoredArtifact: storageDelete,
      deleteArtifactMetadata: async (recordId: number, tx: DbTx) => {
        const execDb = tx || db;
        await execDb.delete(scanArtifacts).where(eq(scanArtifacts.scanRecordId, recordId));
      },
      deleteScanMetadata: async (recordId: number, tx: DbTx) => {
        const execDb = tx || db;
        await execDb.delete(scanRecords).where(eq(scanRecords.id, recordId));
      },
      runInTransaction: async <T>(callback: (tx: DbTx) => Promise<T>) => {
        return await db.transaction(callback);
      },
      markIntentsCancelled: async (recordId: number, tx: DbTx) => {
        const execDb = tx || db;
        await execDb.update(scanArtifactIntents).set({ state: "cancelled" })
          .where(and(eq(scanArtifactIntents.scanRecordId, recordId), eq(scanArtifactIntents.state, "pending")));
      },
      listIntentsForScan: async (recordId: number) => {
        return (await db.select().from(scanArtifactIntents).where(eq(scanArtifactIntents.scanRecordId, recordId))) as ArtifactIntent[];
      },
      markIntentCleanupComplete: async (intentId: string) => {
        await db.update(scanArtifactIntents).set({ cleanupComplete: 1 }).where(eq(scanArtifactIntents.id, intentId));
      },
      createCleanupIntentsForArtifacts: async (userId: number, artifacts: OwnedArtifact[], tx: DbTx) => {
        const execDb = tx || db;
        const intents: ArtifactIntent[] = [];
        for (const art of artifacts) {
          if (art.storageKey.startsWith("pending:")) continue;
          const intentId = crypto.randomUUID();
          await execDb.insert(scanArtifactIntents).values({
            id: intentId,
            scanRecordId: null,
            userId: userId,
            artifactType: art.artifactType as any,
            storageKey: art.storageKey,
            displacedStorageKey: null,
            state: "cancelled",
            cleanupComplete: 0,
            retryCount: 0,
          });
          intents.push({
            id: intentId, scanRecordId: null, userId, artifactType: art.artifactType as any,
            storageKey: art.storageKey, displacedStorageKey: null, state: "cancelled", expectedRevision: null, cleanupComplete: 0
          });
        }
        return intents;
      }
    };

    return deleteAllOwnedScans(ctx.user.id, deps as any);
  }),
});
