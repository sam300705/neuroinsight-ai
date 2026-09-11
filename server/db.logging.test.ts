import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { drizzleMock } = vi.hoisted(() => ({
  drizzleMock: vi.fn(),
}));

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: drizzleMock,
}));

import { getDb } from "./db";

const originalDatabaseUrl = process.env.DATABASE_URL;

describe("database operational logging", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://user:secret@database.example/app";
    drizzleMock.mockReset();
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    vi.restoreAllMocks();
  });

  it("logs only a bounded error type when connection setup fails", async () => {
    const privateDetail = "mysql://user:secret@database.example/app";
    drizzleMock.mockImplementation(() => {
      throw new TypeError(privateDetail);
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(getDb()).resolves.toBeNull();

    expect(warn).toHaveBeenCalledWith("[Database] Failed to connect", {
      errorType: "TypeError",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain(privateDetail);
  });
});
