import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ getDb: vi.fn() }));

import { getDb } from "../db";
import { scansRouter } from "./scans";

const mockedGetDb = vi.mocked(getDb);
const caller = () => scansRouter.createCaller({ user: { id: 7 } } as never);

const record = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  scanId: "11111111-1111-4111-8111-111111111111",
  userId: 7,
  mode: "classification",
  status: "complete",
  modelVersion: "EXP-005",
  processingTimeMs: 100,
  predictedClass: "glioma",
  confidenceScore: "0.75000",
  calibrated: 1,
  uncertaintyReason: null,
  manualReviewRecommended: 0,
  measurementJson: JSON.stringify({
    kind: "unavailable",
    metadataConfirmed: false,
    limitation: "Synthetic test fixture",
  }),
  warningsJson: JSON.stringify(["Synthetic warning"]),
  createdAt: new Date("2026-09-06T00:00:00Z"),
  ...overrides,
});

const databaseFor = (records: ReturnType<typeof record>[], artifacts: unknown[] = []) => {
  const recordQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(records),
  };
  const artifactQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(artifacts),
  };
  return {
    select: vi.fn()
      .mockReturnValueOnce(recordQuery)
      .mockReturnValueOnce(artifactQuery),
  };
};

describe("scan history listing reliability", () => {
  beforeEach(() => vi.clearAllMocks());

  it("distinguishes an unavailable database from healthy empty history", async () => {
    mockedGetDb.mockResolvedValueOnce(null);
    await expect(caller().list({})).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Scan history is temporarily unavailable.",
    });

    mockedGetDb.mockResolvedValueOnce(databaseFor([]) as never);
    await expect(caller().list({})).resolves.toEqual({
      items: [],
      nextCursor: null,
      omittedCorruptRecords: 0,
    });
  });

  it("maps database query failures to a safe service-unavailable error", async () => {
    const db = {
      select: vi.fn(() => {
        throw new Error("mysql://private-host/table");
      }),
    };
    mockedGetDb.mockResolvedValueOnce(db as never);
    const error = await caller().list({}).catch(value => value as Error & { code: string });
    expect(error.code).toBe("SERVICE_UNAVAILABLE");
    expect(error.message).toBe("Scan history is temporarily unavailable.");
    expect(error.message).not.toContain("private-host");
  });

  it("quarantines corrupt stored JSON without exposing it or losing valid rows", async () => {
    const corrupt = record({ id: 11, measurementJson: "{patient-private-invalid-json" });
    mockedGetDb.mockResolvedValueOnce(databaseFor([corrupt, record()]) as never);
    const result = await caller().list({});
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(10);
    expect(result.items[0].measurement).toEqual({
      kind: "unavailable",
      metadataConfirmed: false,
      limitation: "Synthetic test fixture",
    });
    expect(result.omittedCorruptRecords).toBe(1);
    expect(JSON.stringify(result)).not.toContain("patient-private-invalid-json");
  });

  it("quarantines wrong schemas and non-finite confidence values", async () => {
    const records = [
      record({ id: 13, warningsJson: JSON.stringify({ warning: "wrong" }) }),
      record({ id: 12, measurementJson: JSON.stringify({ kind: "unavailable" }) }),
      record({ id: 11, confidenceScore: "not-a-number" }),
      record(),
    ];
    mockedGetDb.mockResolvedValueOnce(databaseFor(records) as never);
    const result = await caller().list({});
    expect(result.items.map(item => item.id)).toEqual([10]);
    expect(result.omittedCorruptRecords).toBe(3);
  });
});


describe("history output contract", () => {
  it("does not return raw stored JSON, internal owner IDs or unknown fields", async () => {
    mockedGetDb.mockResolvedValueOnce(databaseFor([record({
      measurementJson: JSON.stringify({ kind: "unavailable", metadataConfirmed: false, limitation: "test", private: "hidden-payload" }),
      internalField: "hidden-internal",
    })]) as never);
    const result = await caller().list({});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).not.toHaveProperty("measurementJson");
    expect(result.items[0]).not.toHaveProperty("warningsJson");
    expect(result.items[0]).not.toHaveProperty("userId");
    expect(JSON.stringify(result)).not.toContain("hidden-");
  });
  it.each([
    { confidenceScore: "1.5" }, { confidenceScore: "-0.1" }, { confidenceScore: "" },
    { calibrated: 2 }, { manualReviewRecommended: -1 }, { status: "invented" },
    { createdAt: new Date("invalid") }, { measurementJson: "x".repeat(32769) },
  ])("omits invalid stored values %o", async overrides => {
    mockedGetDb.mockResolvedValueOnce(databaseFor([record(overrides)]) as never);
    await expect(caller().list({})).resolves.toMatchObject({ items: [], omittedCorruptRecords: 1 });
  });
  it("advances the raw-page cursor when every visible row is corrupt", async () => {
    mockedGetDb.mockResolvedValueOnce(databaseFor([
      record({ id: 12, warningsJson: "bad" }), record({ id: 11, warningsJson: "bad" }), record({ id: 10 }),
    ]) as never);
    await expect(caller().list({ limit: 2 })).resolves.toEqual({ items: [], omittedCorruptRecords: 2, nextCursor: 11 });
  });
});
