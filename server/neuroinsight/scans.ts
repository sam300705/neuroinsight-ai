import { and, desc, eq } from "drizzle-orm";
import { scanArtifacts, scanRecords } from "../../drizzle/schema";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { artifactRegistrationSchema, scanResultSchema, validateArtifactPayload } from "./validation";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const scansRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const records = await db.select().from(scanRecords).where(eq(scanRecords.userId, ctx.user.id)).orderBy(desc(scanRecords.createdAt));
    const artifacts = records.length ? await db.select().from(scanArtifacts) : [];
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
    const bytes = validateArtifactPayload(input.base64, input.contentType);
    const stored = await storagePut(`neuroinsight/${ctx.user.id}/${input.scanId}/${input.artifactType}-${input.fileName}`, bytes, input.contentType);
    await db.insert(scanArtifacts).values({ scanRecordId: record.id, artifactType: input.artifactType, storageKey: stored.key, storageUrl: stored.url, contentType: input.contentType });
    return stored;
  }),

  deleteOne: protectedProcedure.input(z.object({ scanId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const db = await getDb(); if (!db) throw new Error("Scan history database is unavailable.");
    const [record] = await db.select().from(scanRecords).where(and(eq(scanRecords.userId, ctx.user.id), eq(scanRecords.scanId, input.scanId))).limit(1);
    if (!record) return { deleted: false };
    await db.delete(scanArtifacts).where(eq(scanArtifacts.scanRecordId, record.id));
    await db.delete(scanRecords).where(eq(scanRecords.id, record.id));
    return { deleted: true };
  }),

  deleteAll: protectedProcedure.input(z.object({ confirmation: z.literal("DELETE_ALL_RESEARCH_HISTORY") })).mutation(async ({ ctx }) => {
    const db = await getDb(); if (!db) throw new Error("Scan history database is unavailable.");
    const records = await db.select({ id: scanRecords.id }).from(scanRecords).where(eq(scanRecords.userId, ctx.user.id));
    for (const record of records) await db.delete(scanArtifacts).where(eq(scanArtifacts.scanRecordId, record.id));
    await db.delete(scanRecords).where(eq(scanRecords.userId, ctx.user.id));
    return { deletedCount: records.length };
  }),
});

