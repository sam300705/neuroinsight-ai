import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./env";
import {
  createHeartbeatJob,
  deleteHeartbeatJob,
  listHeartbeatJobs,
  updateHeartbeatJob,
} from "./heartbeat";

const originalForgeUrl = ENV.forgeApiUrl;
const originalForgeKey = ENV.forgeApiKey;

const validJob = {
  taskUid: "task-1",
  name: "daily-check",
  userId: "user-1",
  description: "Synthetic check",
  cronExpression: "0 0 9 * * *",
  callbackPath: "/api/scheduled/check",
  callbackMethod: "POST",
  callbackPayload: "{}",
  isEnable: true,
};

describe("heartbeat provider boundary", () => {
  beforeEach(() => {
    ENV.forgeApiUrl = "https://forge.example";
    ENV.forgeApiKey = "test-only-key";
  });

  afterEach(() => {
    ENV.forgeApiUrl = originalForgeUrl;
    ENV.forgeApiKey = originalForgeKey;
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates a validated job with an abort signal", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ taskUid: "task-1", nextExecutionAt: null }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createHeartbeatJob(
        {
          name: "daily-check",
          cron: "0 0 9 * * *",
          path: "/api/scheduled/check",
        },
        "session-1"
      )
    ).resolves.toEqual({ taskUid: "task-1", nextExecutionAt: null });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      signal: expect.any(AbortSignal),
    });
  });

  it("rejects unsafe paths, cron expressions, identifiers, sessions, and pagination", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const base = {
      name: "daily-check",
      cron: "0 0 9 * * *",
      path: "/api/scheduled/check",
    };
    await expect(
      createHeartbeatJob({ ...base, path: "/api/scheduled/%2e%2e/admin" }, "")
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      createHeartbeatJob({ ...base, method: "DELETE" as unknown as "POST" }, "")
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      createHeartbeatJob({ ...base, cron: "* * * * *" }, "")
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(deleteHeartbeatJob("\n", "")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      deleteHeartbeatJob("task-1", "x".repeat(2049))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      listHeartbeatJobs("", { page: 0, pageSize: 101 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects circular and oversized callback payloads before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const base = {
      name: "daily-check",
      cron: "0 0 9 * * *",
      path: "/api/scheduled/check",
    };
    await expect(
      createHeartbeatJob({ ...base, payload: circular }, "")
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      createHeartbeatJob({ ...base, payload: "x".repeat(64 * 1024 + 1) }, "")
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps provider errors without exposing its response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("provider-secret", {
          status: 429,
          statusText: "private",
        })
      )
    );
    const error = await deleteHeartbeatJob("task-1", "").catch(
      value => value as TRPCError
    );
    expect(error.code).toBe("TOO_MANY_REQUESTS");
    expect(error.message).toBe("Heartbeat DeleteHeartbeatJob failed (429)");
    expect(error.message).not.toContain("provider-secret");
    expect(error.message).not.toContain("private");
  });

  it("aborts a genuinely hanging request at the deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          (_url: string, init: RequestInit) =>
            new Promise((_resolve, reject) =>
              init.signal?.addEventListener("abort", () =>
                reject(new DOMException("private timeout", "AbortError"))
              )
            )
        )
    );
    const request = deleteHeartbeatJob("task-1", "");
    const assertion = expect(request).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Heartbeat DeleteHeartbeatJob request failed",
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it("rejects oversized, malformed, and schema-invalid responses", async () => {
    for (const body of [
      "not-json",
      "x".repeat(512 * 1024 + 1),
      JSON.stringify({ taskUid: "" }),
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
      );
      await expect(
        createHeartbeatJob(
          {
            name: "daily-check",
            cron: "0 0 9 * * *",
            path: "/api/scheduled/check",
          },
          ""
        )
      ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    }
  });

  it("validates update and list responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ nextExecutionAt: "2026-09-07T09:00:00Z" }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ total: 1, actorUserId: "user-1", jobs: [validJob] }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      updateHeartbeatJob("task-1", { cron: "0 30 9 * * *" }, "")
    ).resolves.toEqual({ nextExecutionAt: "2026-09-07T09:00:00Z" });
    await expect(
      listHeartbeatJobs("", { page: 1, pageSize: 10 })
    ).resolves.toEqual({ total: 1, actorUserId: "user-1", jobs: [validJob] });
  });

  it("rejects malformed list entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            total: 1,
            actorUserId: "user-1",
            jobs: [{ ...validJob, callbackPayload: "x".repeat(64 * 1024 + 1) }],
          }),
          { status: 200 }
        )
      )
    );
    await expect(listHeartbeatJobs("")).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Heartbeat service returned an invalid response",
    });
  });
});
