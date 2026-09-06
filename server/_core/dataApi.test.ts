import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./env";
import { callDataApi } from "./dataApi";

const originalForgeUrl = ENV.forgeApiUrl;
const originalForgeKey = ENV.forgeApiKey;

describe("Data API boundary", () => {
  beforeEach(() => {
    ENV.forgeApiUrl = "https://forge.example";
    ENV.forgeApiKey = "test-only-key";
  });

  afterEach(() => {
    ENV.forgeApiUrl = originalForgeUrl;
    ENV.forgeApiKey = originalForgeKey;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("passes an abort signal and returns a validated jsonData result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jsonData: JSON.stringify({ ok: true }) }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(callDataApi("test-api")).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: expect.any(AbortSignal) });
  });

  it("rejects malformed JSON, wrong shapes, and malformed jsonData safely", async () => {
    for (const body of ["not-json", JSON.stringify([]), JSON.stringify({ jsonData: 42 }), JSON.stringify({ jsonData: "not-json" })]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
      await expect(callDataApi("test-api")).rejects.toThrow("Data API returned an invalid response");
    }
  });

  it("rejects oversized responses without exposing their contents", async () => {
    const privateDetail = "provider-token=private";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ privateDetail }) + "x".repeat(1_048_576), { status: 200 })));
    const rejection = callDataApi("test-api");
    await expect(rejection).rejects.toThrow("Data API returned an invalid response");
    await expect(rejection).rejects.not.toThrow(privateDetail);
  });

  it("maps non-2xx and timeout failures to safe errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private body", { status: 503, statusText: "secret" })));
    await expect(callDataApi("test-api")).rejects.toThrow("Data API request failed (503)");
    await expect(callDataApi("test-api")).rejects.not.toThrow("private body");
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "AbortError")));
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const hangingRequest = callDataApi("test-api");
    const hangingAssertion = expect(hangingRequest).rejects.toThrow("Data API request failed");
    await vi.advanceTimersByTimeAsync(10_000);
    await hangingAssertion;
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: expect.any(AbortSignal) });
    vi.useRealTimers();
  });
});