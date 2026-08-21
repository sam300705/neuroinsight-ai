import { decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Core user table backing the preconfigured OAuth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Stores analysis metadata only. Raw MRI pixels are never stored in this table. */
export const scanRecords = mysqlTable("scan_records", {
  id: int("id").autoincrement().primaryKey(),
  scanId: varchar("scanId", { length: 64 }).notNull().unique(),
  userId: int("userId").notNull(),
  mode: mysqlEnum("mode", ["classification", "segmentation"]).notNull(),
  status: mysqlEnum("status", ["complete", "low_confidence", "incompatible", "partial", "unavailable"]).notNull(),
  modelVersion: varchar("modelVersion", { length: 128 }).notNull(),
  processingTimeMs: int("processingTimeMs").notNull(),
  predictedClass: mysqlEnum("predictedClass", ["glioma", "meningioma", "pituitary", "no_tumor"]),
  confidenceScore: decimal("confidenceScore", { precision: 6, scale: 5 }),
  calibrated: int("calibrated").notNull().default(0),
  uncertaintyReason: text("uncertaintyReason"),
  manualReviewRecommended: int("manualReviewRecommended").notNull().default(1),
  measurementJson: text("measurementJson").notNull(),
  warningsJson: text("warningsJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("scan_records_user_created_idx").on(table.userId, table.createdAt), index("scan_records_user_status_idx").on(table.userId, table.status)]);

/** Stores only returned S3 key/URL and MIME type for durable derived artifacts. */
export const scanArtifacts = mysqlTable("scan_artifacts", {
  id: int("id").autoincrement().primaryKey(),
  scanRecordId: int("scanRecordId").notNull(),
  artifactType: mysqlEnum("artifactType", ["report", "grad_cam", "segmentation_mask", "three_dimensional"]).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 1024 }).notNull(),
  contentType: varchar("contentType", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("scan_artifacts_scan_idx").on(table.scanRecordId), index("scan_artifacts_type_idx").on(table.artifactType)]);

export type ScanRecord = typeof scanRecords.$inferSelect;
export type InsertScanRecord = typeof scanRecords.$inferInsert;
export type ScanArtifact = typeof scanArtifacts.$inferSelect;
