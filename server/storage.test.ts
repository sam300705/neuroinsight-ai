import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { storageDelete, storagePutStable } from "./storage";

const originalForgeUrl = ENV.forgeApiUrl;
const originalForgeKey = ENV.forgeApiKey;

describe("managed storage lifecycle", () => {
  beforeEach(() => {
    ENV.forgeApiUrl = "https://forge.example";
    ENV.forgeApiKey = "test-only-key";
  });

  afterEach(() => {
    ENV.forgeApiUrl = originalForgeUrl;
    ENV.forgeApiKey = originalForgeKey;
    vi.unstubAllGlobals();
  });

  it("deletes the exact normalized key through the authenticated provider endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await storageDelete("/neuroinsight/7/scan/report.pdf");
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://forge.example/v1/storage/delete?path=neuroinsight%2F7%2Fscan%2Freport.pdf");
    expect(options).toMatchObject({ method: "DELETE", headers: { Authorization: "Bearer test-only-key" } });
  });

  it("fails closed on provider deletion errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(storageDelete("neuroinsight/7/scan/report.pdf")).rejects.toThrow("Storage deletion failed (503)");
  });

  it("uses a stable retry-safe object key for an owned artifact slot", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://object.example/upload" }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const stored = await storagePutStable("neuroinsight/7/scan/report.pdf", Buffer.from("%PDF"), "application/pdf");
    expect(stored.key).toBe("neuroinsight/7/scan/report.pdf");
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://forge.example/v1/storage/presign/put?path=neuroinsight%2F7%2Fscan%2Freport.pdf");
    expect(fetchMock.mock.calls[1][0]).toBe("https://object.example/upload");
  });
});
