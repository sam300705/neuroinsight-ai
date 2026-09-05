import { and, desc, eq, inArray, like, lt } from "drizzle-orm";
import { scanArtifacts, scanRecords } from "../../drizzle/schema";
import { getDb } from "../db";
import { storageDelete, storageGetSignedUrl, storagePutStable } from "../storage";
import { artifactRegistrationSchema, scanResultSchema, validateArtifactPayload } from "./validation";
import { deleteAllOwnedScans, deleteOwnedScan, issueOwnedArtifactDownload } from "./artifactLifecycle";
import { ACTIVE_HISTORY_MODE, historyListInputSchema } from "./historyPolicy";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const scansRouter = router({
  list: protectedProcedure.input(historyListInputSchema).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { items: [], nextCursor: null };
    const conditions = [eq(scanRecords.userId, ctx.user.id), eq(scanRecords.mode, ACTIVE_HISTORY_MODE), input.cursor ? lt(scanRecords.id, input.cursor) : undefined, input.predictedClass ? eq(scanRecords.predictedClass, input.predictedClass) : undefined, input.status ? eq(scanRecords.status, input.status) : undefined, input.search ? like(scanRecords.scanId, `%${input.search.replace(/[\\%_]/g, "\\$&")}%`) : undefined].filter(Boolean);
    const records = await db.select().from(scanRecords).where(and(...conditions)).orderBy(desc(scanRecords.id)).limit(input.limit + 1);
    const hasNextPage = records.length > input.limit;
    const page = hasNextPage ? records.slice(0, input.limit) : records;
    const artifacts = page.length
      ? await db.select().from(scanArtifacts).where(inArray(scanArtifacts.scanRecordId, page.map(record => record.id)))
      : [];
    return { items: page.map(record => ({ ...record, confidenceScore: record.confidenceScore === null ? null : Number(record.confidenceScore), calibrated: Boolean(record.calibrated), manualReviewRecommended: Boolean(record.manualReviewRecommended), measurement: JSON.parse(record.measurementJson), warnings: JSON.parse(record.warningsJson), artifacts: artifacts.filter(artifact => artifact.scanRecordId === record.id && !artifact.storageKey.startsWith("pending:")).map(artifact => ({ id: artifact.id, artifactType: artifact.artifactType, contentType: artifact.contentType, createdAt: artifact.createdAt })) })), nextCursor: hasNextPage ? page.at(-1)?.id ?? null : null };
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
    const [record] = await db.select().from(scanRecords).where(and(eq(scanRecords.userId, ctx.user.id), eq(scanRecords.scanId, input.scanId))).limit(1);
    if (!record) throw new Error("Scan record was not found for this user.");
    const bytes = validateArtifactPayload(input.base64, input.contentType);
    const [existing] = await db.select({ id: scanArtifacts.id }).from(scanArtifacts).where(and(eq(scanArtifacts.scanRecordId, record.id), eq(scanArtifacts.artifactType, input.artifactType))).limit(1);
    const extension = input.artifactType === "report" ? "pdf" : "png";
    const stored = await storagePutStable(`neuroinsight/${ctx.user.id}/${input.scanId}/${input.artifactType}.${extension}`, bytes, input.contentType);
    await db.insert(scanArtifacts).values({ scanRecordId: record.id, artifactType: input.artifactType, storageKey: stored.key, storageUrl: "ownership-scoped-download-only", contentType: input.contentType }).onDuplicateKeyUpdate({ set: { storageKey: stored.key, storageUrl: "ownership-scoped-download-only", contentType: input.contentType } });
    return { artifactType: input.artifactType, contentType: input.contentType, existing: Boolean(existing), pending: false };
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
      findOwnedScan: async (userId, scanId) => {
        const [record] = await db.select({ id: scanRecords.id }).from(scanRecords).where(and(eq(scanRecords.userId, userId), eq(scanRecords.scanId, scanId))).limit(1);
        if (!record) return undefined;
        const artifacts = await db.select({ id: scanArtifacts.id, storageKey: scanArtifacts.storageKey, artifactType: scanArtifacts.artifactType }).from(scanArtifacts).where(eq(scanArtifacts.scanRecordId, record.id));
        return { ...record, artifacts };
      },
      deleteStoredArtifact: storageDelete,
      deleteArtifactMetadata: async recordId => { await db.delete(scanArtifacts).where(eq(scanArtifacts.scanRecordId, recordId)); },
      deleteScanMetadata: async recordId => { await db.delete(scanRecords).where(eq(scanRecords.id, recordId)); },
    });
  }),

  deleteAll: protectedProcedure.input(z.object({ confirmation: z.literal("DELETE_ALL_RESEARCH_HISTORY") })).mutation(async ({ ctx }) => {
    const db = await getDb(); if (!db) throw new Error("Scan history database is unavailable.");
    return deleteAllOwnedScans(ctx.user.id, {
      listOwnedScans: async userId => {
        const records = await db.select({ id: scanRecords.id }).from(scanRecords).where(eq(scanRecords.userId, userId));
        if (!records.length) return [];
        const artifacts = await db.select({ id: scanArtifacts.id, scanRecordId: scanArtifacts.scanRecordId, storageKey: scanArtifacts.storageKey, artifactType: scanArtifacts.artifactType }).from(scanArtifacts).where(inArray(scanArtifacts.scanRecordId, records.map(record => record.id)));
        return records.map(record => ({ ...record, artifacts: artifacts.filter(artifact => artifact.scanRecordId === record.id).map(({ scanRecordId: _scanRecordId, ...artifact }) => artifact) }));
      },
      deleteStoredArtifact: storageDelete,
      deleteArtifactMetadata: async recordId => { await db.delete(scanArtifacts).where(eq(scanArtifacts.scanRecordId, recordId)); },
      deleteScanMetadata: async recordId => { await db.delete(scanRecords).where(eq(scanRecords.id, recordId)); },
    });
  }),
});
