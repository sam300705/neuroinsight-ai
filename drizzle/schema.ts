import { decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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
  scanId: varchar("scanId", { length: 64 }).notNull(),
  // Cleanup intents are the only rows allowed to outlive their parent. Scan metadata stays
  // attached to a real account so accidental/direct user deletion fails closed.
  userId: int("userId").notNull().references(() => users.id, { onDelete: "restrict" }),
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
}, table => [
  uniqueIndex("scan_records_user_scan_unique").on(table.userId, table.scanId),
  index("scan_records_user_id_idx").on(table.userId, table.id),
  index("scan_records_user_created_idx").on(table.userId, table.createdAt),
  index("scan_records_user_status_idx").on(table.userId, table.status),
]);

/** Stores only returned S3 key/URL and MIME type for durable derived artifacts. */
export const scanArtifacts = mysqlTable("scan_artifacts", {
  id: int("id").autoincrement().primaryKey(),
  // Active artifact metadata must never silently detach from its owning scan. Application
  // deletion removes the artifact row only after recording a durable cleanup intent.
  scanRecordId: int("scanRecordId").notNull().references(() => scanRecords.id, { onDelete: "restrict" }),
  artifactType: mysqlEnum("artifactType", ["report", "grad_cam", "segmentation_mask", "three_dimensional"]).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 1024 }).notNull(),
  contentType: varchar("contentType", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("scan_artifacts_record_type_unique").on(table.scanRecordId, table.artifactType),
  index("scan_artifacts_scan_idx").on(table.scanRecordId),
  index("scan_artifacts_type_idx").on(table.artifactType),
]);

export type ScanRecord = typeof scanRecords.$inferSelect;
export type InsertScanRecord = typeof scanRecords.$inferInsert;
export type ScanArtifact = typeof scanArtifacts.$inferSelect;

/**
 * Durable intent and cleanup bookkeeping for artifact lifecycle management.
 * Allows safe recovery from ambiguous database commits and protects against concurrent races.
 */
export const scanArtifactIntents = mysqlTable("scan_artifact_intents", {
  id: varchar("id", { length: 64 }).primaryKey(), // Unique operation ID
  scanRecordId: int("scanRecordId").references(() => scanRecords.id, { onDelete: "set null" }),
  userId: int("userId").notNull(), // Detached intentionally so cleanup can finish after parent deletion
  artifactType: mysqlEnum("artifactType", ["report", "grad_cam", "segmentation_mask", "three_dimensional"]).notNull(),

  // The immutable object key that this intent is attempting to upload or clean up
  storageKey: varchar("storageKey", { length: 512 }).notNull(),

  // Clean up the displaced storage key when replacing an artifact
  displacedStorageKey: varchar("displacedStorageKey", { length: 512 }),

  // "pending": Upload intent recorded but not yet committed
  // "committed": Transaction committed the metadata change, cleanup can proceed
  // "cancelled": Upload failed or cancelled, unreferenced storage key must be cleaned up
  state: mysqlEnum("state", ["pending", "committed", "cancelled"]).notNull(),

  // Expected artifact revision or concurrency token (useful for CAS or ordering)
  expectedRevision: int("expectedRevision"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),

  // True if the associated physical artifacts have been successfully deleted from storage
  cleanupComplete: int("cleanupComplete").notNull().default(0),

  // Number of retry attempts for cleanup or reconciliation
  retryCount: int("retryCount").notNull().default(0),
}, table => [
  index("scan_artifact_intents_scan_idx").on(table.scanRecordId),
  index("scan_artifact_intents_user_idx").on(table.userId),
  index("scan_artifact_intents_state_cleanup_idx").on(table.state, table.cleanupComplete),
]);

export type ScanArtifactIntent = typeof scanArtifactIntents.$inferSelect;
export type InsertScanArtifactIntent = typeof scanArtifactIntents.$inferInsert;
