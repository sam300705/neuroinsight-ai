import { and, desc, eq, inArray } from "drizzle-orm";
import { scanArtifacts, scanRecords } from "../../drizzle/schema";
import { getDb } from "../db";
import { storageGetSignedUrl, storagePut } from "../storage";
import { artifactRegistrationSchema, scanResultSchema, validateArtifactPayload } from "./validation";
import { deleteAllOwnedScans, deleteOwnedScan, issueOwnedArtifactDownload } from "./artifactLifecycle";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const scansRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const records = await db.select().from(scanRecords).where(eq(scanRecords.userId, ctx.user.id)).orderBy(desc(scanRecords.createdAt));
    const artifacts = records.length
      ? await db.select().from(scanArtifacts).where(inArray(scanArtifacts.scanRecordId, records.map(record => record.id)))
      : [];
    return records.map(record => ({ ...record, confidenceScore: record.confidenceScore === null ? null : Number(record.confidenceScore), calibrated: Boolean(record.calibrated), manualReviewRecommended: Boolean(record.manualReviewRecommended), measurement: JSON.parse(record.measurementJson), warnings: JSON.parse(record.warningsJson), artifacts: artifacts.filter(artifact => artifact.scanRecordId === record.id) }));
  }),

  saveResult: protectedProcedure.input(scanResultSchema).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Scan history database is unavailable.");
    await db.insert(scanRecords).values({ scanId: input.scanId, userId: ctx.user.id, mode: input.mode, status: input.status, modelVersion: input.modelVersion, processingTimeMs: input.processingTimeMs, predictedClass: input.predictedClass, confidenceScore: input.confidenceScore?.toFixed(5), calibrated: input.calibrated ? 1 : 0, uncertaintyReason: input.uncertaintyReason, manualReviewRecommended: input.manualReviewRecommended ? 1 : 0, measurementJson: JSON.stringify(input.measurement), warningsJson: JSON.stringify(input.warnings) }).onDuplicateKeyUpdate({ set: { status: input.status, modelVersion: input.modelVersion, processingTimeMs: input.processingTimeMs, predictedClass: input.predictedClass, confidenceScore: input.confidenceScore?.toFixed(5), calibrated: input.calibrated ? 1 : 0, uncertaintyReason: input.uncertaintyReason, manualReviewRecommended: input.manualReviewRecommended ? 1 : 0, measurementJson: JSON.stringify(input.measurement), warningsJson: JSON.stringify(input.warnings) } });
    return { scanId: input.scanId };
  }),

  registerArtifact: protectedProcedure.input(artifactRegistrationSchema).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Scan history database is unavailable.");
    const [record] = await db.select().from(scanRecords).where(and(eq(scanRecords.userId, ctx.user.id), eq(scanRecords.scanId, input.scanId))).limit(1);
    if (!record) throw new Error("Scan record was not found for this user.");
    const [existing] = await db.select().from(scanArtifacts).where(and(eq(scanArtifacts.scanRecordId, record.id), eq(scanArtifacts.artifactType, input.artifactType))).limit(1);
    if (existing) return { key: existing.storageKey, url: existing.storageUrl, contentType: existing.contentType, existing: true };
    const bytes = validateArtifactPayload(input.base64, input.contentType);
    const stored = await storagePut(`neuroinsight/${ctx.user.id}/${input.scanId}/${input.artifactType}-${input.fileName}`, bytes, input.contentType);
    await db.insert(scanArtifacts).values({ scanRecordId: record.id, artifactType: input.artifactType, storageKey: stored.key, storageUrl: stored.url, contentType: input.contentType });
    return { ...stored, existing: false };
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
        return record;
      },
      deleteArtifactMetadata: async recordId => { await db.delete(scanArtifacts).where(eq(scanArtifacts.scanRecordId, recordId)); },
      deleteScanMetadata: async recordId => { await db.delete(scanRecords).where(eq(scanRecords.id, recordId)); },
    });
  }),

  deleteAll: protectedProcedure.input(z.object({ confirmation: z.literal("DELETE_ALL_RESEARCH_HISTORY") })).mutation(async ({ ctx }) => {
    const db = await getDb(); if (!db) throw new Error("Scan history database is unavailable.");
    return deleteAllOwnedScans(ctx.user.id, {
      listOwnedScanIds: async userId => (await db.select({ id: scanRecords.id }).from(scanRecords).where(eq(scanRecords.userId, userId))).map(record => record.id),
      deleteArtifactMetadata: async recordId => { await db.delete(scanArtifacts).where(eq(scanArtifacts.scanRecordId, recordId)); },
      deleteAllScanMetadata: async userId => { await db.delete(scanRecords).where(eq(scanRecords.userId, userId)); },
    });
  }),
});
