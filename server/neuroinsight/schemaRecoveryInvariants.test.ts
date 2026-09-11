import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const schema = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const detachMigration = readFileSync(resolve(root, "drizzle/0005_conscious_jocasta.sql"), "utf8");
const restoreMigration = readFileSync(resolve(root, "drizzle/0006_restore_referential_guards.sql"), "utf8");
const journal = readFileSync(resolve(root, "drizzle/meta/_journal.json"), "utf8");

describe("artifact recovery schema invariants", () => {
  it("allows cleanup intents, but not active artifact metadata, to survive parent deletion", () => {
    expect(schema).toContain('scanRecordId: int("scanRecordId").references(() => scanRecords.id, { onDelete: "set null" })');
    expect(schema).toContain('scanRecordId: int("scanRecordId").notNull().references(() => scanRecords.id, { onDelete: "restrict" })');
    expect(schema).toContain('userId: int("userId").notNull().references(() => users.id, { onDelete: "restrict" })');
    expect(detachMigration).toContain('ON DELETE set null');
    expect(restoreMigration).toContain('MODIFY COLUMN `scanRecordId` int NOT NULL');
    expect(restoreMigration).toContain('ON DELETE restrict');
  });

  it("keeps the corrective migration in the migration journal", () => {
    expect(journal).toContain('0006_restore_referential_guards');
  });
});
