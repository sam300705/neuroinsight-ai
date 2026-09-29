import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./env";
import { makeRequest } from "./map";

const originalForgeUrl = ENV.forgeApiUrl;
const originalForgeKey = ENV.forgeApiKey;

describe("Google Maps proxy boundary", () => {
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

  it("constructs a fixed proxy request with bounded parameters", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "OK", results: [] }), {
          status: 200,
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      makeRequest("/maps/api/geocode/json", {
        address: "Synthetic Street",
        types: ["a", "b"],
      })
    ).resolves.toEqual({ status: "OK", results: [] });
    const requestUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestUrl.origin).toBe("https://forge.example");
    expect(requestUrl.pathname).toBe("/v1/maps/proxy/maps/api/geocode/json");
    expect(requestUrl.searchParams.get("types")).toBe("a|b");
    expect(requestUrl.searchParams.get("key")).toBe("test-only-key");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "GET",
      signal: expect.any(AbortSignal),
    });
  });

  it("rejects endpoint path confusion and SSRF attempts before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const endpoint of [
      "https://evil.example/maps/api/geocode/json",
      "//evil.example/path",
      "/maps/api/../admin",
      "/maps/api/%2e%2e/admin",
      "/maps/api/geocode/json?redirect=https://evil.example",
      "/maps/api/geocode/json#fragment",
      "/maps\\api\\geocode\\json",
    ]) {
      await expect(makeRequest(endpoint)).rejects.toThrow(
        "Google Maps endpoint is invalid"
      );
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects reserved, malformed, excessive, and oversized parameters", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const endpoint = "/maps/api/geocode/json";
    await expect(
      makeRequest(endpoint, { key: "attacker-key" })
    ).rejects.toThrow("Google Maps parameters are invalid");
    await expect(
      makeRequest(endpoint, { value: { nested: true } })
    ).rejects.toThrow("Google Maps parameters are invalid");
    await expect(
      makeRequest(
        endpoint,
        Object.fromEntries(
          Array.from({ length: 33 }, (_, index) => [`p${index}`, index])
        )
      )
    ).rejects.toThrow("Google Maps parameters are invalid");
    await expect(
      makeRequest(endpoint, { address: "x".repeat(2049) })
    ).rejects.toThrow("Google Maps parameters are invalid");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds and validates POST bodies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "OK" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      makeRequest(
        "/v1/snapToRoads",
        {},
        { method: "POST", body: { path: "1,2|3,4" } }
      )
    ).resolves.toEqual({ status: "OK" });
    await expect(
      makeRequest("/v1/snapToRoads", {}, { body: { path: "x" } })
    ).rejects.toThrow("Google Maps GET requests cannot include a body");
    await expect(
      makeRequest(
        "/v1/snapToRoads",
        {},
        { method: "POST", body: { path: "x".repeat(64 * 1024 + 1) } }
      )
    ).rejects.toThrow("Google Maps request body is too large");
  });

  it("maps non-2xx failures without provider details", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("provider-secret", {
            status: 403,
            statusText: "private",
          })
        )
    );
    const error = await makeRequest("/maps/api/geocode/json").catch(
      value => value as Error
    );
    expect(error.message).toBe("Google Maps API request failed (403)");
    expect(error.message).not.toContain("provider-secret");
    expect(error.message).not.toContain("private");
    expect(error.message).not.toContain("test-only-key");
  });

  it("rejects malformed and oversized JSON responses", async () => {
    for (const body of [
      "not-json",
      JSON.stringify([]),
      "x".repeat(2 * 1024 * 1024 + 1),
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
      );
      await expect(makeRequest("/maps/api/geocode/json")).rejects.toThrow(
        "Google Maps API returned an invalid response"
      );
    }
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
    const request = makeRequest("/maps/api/geocode/json");
    const assertion = expect(request).rejects.toThrow(
      "Google Maps API request failed"
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it("rejects insecure or credential-bearing proxy configuration", async () => {
    ENV.forgeApiUrl = "https://user:password@forge.example/path?secret=value";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(makeRequest("/maps/api/geocode/json")).rejects.toThrow(
      "Google Maps proxy configuration is invalid"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
