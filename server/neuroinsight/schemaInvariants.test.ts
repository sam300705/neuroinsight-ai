import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const schema = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const migration = readFileSync(resolve(root, "drizzle/0002_steady_rhodey.sql"), "utf8");

describe("history database invariants", () => {
  it("scopes a client scan ID to its owner rather than globally", () => {
    expect(schema).toContain('uniqueIndex("scan_records_user_scan_unique").on(table.userId, table.scanId)');
    expect(schema).not.toContain('scanId: varchar("scanId", { length: 64 }).notNull().unique()');
    expect(migration).toContain("DROP INDEX `scan_records_scanId_unique`");
    expect(migration).toContain("UNIQUE(`userId`,`scanId`)");
  });

  it("permits only one derived artifact type per owned scan", () => {
    expect(schema).toContain('uniqueIndex("scan_artifacts_record_type_unique").on(table.scanRecordId, table.artifactType)');
    expect(migration).toContain("UNIQUE(`scanRecordId`,`artifactType`)");
  });
});
