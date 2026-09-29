import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./env";
import { notifyOwner } from "./notification";

const originalForgeUrl = ENV.forgeApiUrl;
const originalForgeKey = ENV.forgeApiKey;

describe("notification operational safety", () => {
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

  it("uses a bounded request and does not read or log an upstream error body", async () => {
    const privateDetail = "provider-token=private";
    const response = new Response(privateDetail, {
      status: 503,
      statusText: "secret reason",
    });
    const textSpy = vi.spyOn(response, "text");
    const fetchMock = vi.fn().mockResolvedValue(response);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      notifyOwner({ title: "Operational event", content: "Action required" })
    ).resolves.toBe(false);

    expect(textSpy).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      signal: expect.any(AbortSignal),
    });
    expect(warn).toHaveBeenCalledWith("[Notification] Failed to notify owner", {
      status: 503,
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain(privateDetail);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret reason");
  });

  it("logs only a bounded error type for network failures", async () => {
    const privateDetail = "authorization=Bearer secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError(privateDetail))
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      notifyOwner({ title: "Operational event", content: "Action required" })
    ).resolves.toBe(false);

    expect(warn).toHaveBeenCalledWith(
      "[Notification] Error calling notification service",
      { errorType: "TypeError" }
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(privateDetail);
  });
});
