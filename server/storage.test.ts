import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { storageDelete, storageGetSignedUrl, storagePutStable } from "./storage";

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

  it.each([
    "http://object.example/upload",
    "javascript:alert(1)",
    "https://user:password@object.example/upload",
  ])("rejects an unsafe upload URL returned by the provider: %s", async url => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      storagePutStable("neuroinsight/7/scan/report.pdf", Buffer.from("%PDF"), "application/pdf"),
    ).rejects.toThrow("Storage presign service returned an invalid URL");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns only a validated HTTPS download URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ url: "https://object.example/report.pdf?signature=value" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(storageGetSignedUrl("neuroinsight/7/scan/report.pdf")).resolves.toBe(
      "https://object.example/report.pdf?signature=value",
    );
  });

  it("does not expose an upstream error body when download signing fails", async () => {
    const privateDetail = "private provider detail or signed material";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(privateDetail, { status: 503 })));

    const failure = storageGetSignedUrl("neuroinsight/7/scan/report.pdf");
    await expect(failure).rejects.toThrow("Storage signed URL failed (503)");
    await expect(failure).rejects.not.toThrow(privateDetail);
  });

  it.each([
    { url: "http://object.example/report.pdf" },
    { url: "https://user:password@object.example/report.pdf" },
    { url: 42 },
    {},
  ])("rejects an invalid download URL response: %j", async payload => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(storageGetSignedUrl("neuroinsight/7/scan/report.pdf")).rejects.toThrow(
      "Storage download service returned an invalid URL",
    );
  });
  it.each(["http://forge.example", "https://user:pass@forge.example", "https://forge.example#fragment", "https://forge.example?query=x"])("rejects unsafe credential-bearing provider base %s before fetch", async base => {
    ENV.forgeApiUrl = base;
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(storageDelete("owned/report.pdf")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sets redirect refusal on signing, upload and deletion calls", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://object.example/upload" })))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await storagePutStable("owned/report.pdf", Buffer.from("%PDF"));
    await storageDelete("owned/report.pdf");
    for (const [, options] of fetchMock.mock.calls) expect(options.redirect).toBe("error");
  });

  it.each(["declared", "streamed", "malformed"])("bounds %s control responses", async kind => {
    const response = kind === "declared" ? new Response("{}", { headers: { "content-length": "65537" } }) :
      new Response(kind === "streamed" ? JSON.stringify({ private: "x".repeat(65537) }) : "{private-detail");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(storageGetSignedUrl("owned/report.pdf")).rejects.toThrow(/^Storage provider returned an invalid response$/);
    expect(response.body?.locked).toBe(false);
  });

  it("sanitizes network and redirect errors without returning their cause", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret-provider-url")));
    const error = await storageDelete("owned/report.pdf").catch(error => error);
    expect(error.message).toBe("Storage provider request failed");
    expect(error.cause).toBeUndefined();
  });

  it("rejects fragments in signed object URLs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ url: "https://object.example/report.pdf#private" }))));
    await expect(storageGetSignedUrl("owned/report.pdf")).rejects.toThrow("invalid URL");
  });

});
