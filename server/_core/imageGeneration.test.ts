import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./env";

vi.mock("server/storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "/manus-storage/generated/test.png" }),
}));

import { storagePut } from "server/storage";
import { generateImage } from "./imageGeneration";

const originalForgeUrl = ENV.forgeApiUrl;
const originalForgeKey = ENV.forgeApiKey;
const validImage = Buffer.from("synthetic-image").toString("base64");

describe("image generation boundary", () => {
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

  it("validates the response, MIME type, and storage input", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ image: { b64Json: validImage, mimeType: "image/png" } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateImage({ prompt: "synthetic" })).resolves.toEqual({
      url: "/manus-storage/generated/test.png",
    });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: expect.any(AbortSignal) });
    expect(storagePut).toHaveBeenCalledWith(
      expect.stringMatching(/^generated\/.+\.png$/),
      Buffer.from("synthetic-image"),
      "image/png",
    );
  });

  it("rejects malformed JSON, wrong schemas, invalid base64, and unsupported MIME", async () => {
    const bodies = [
      "not-json",
      JSON.stringify({ image: [] }),
      JSON.stringify({ image: { b64Json: "not base64", mimeType: "image/png" } }),
      JSON.stringify({ image: { b64Json: validImage, mimeType: "text/html" } }),
    ];
    for (const body of bodies) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
      await expect(generateImage({ prompt: "synthetic" })).rejects.toThrow(
        "Image generation returned an invalid response",
      );
    }
  });

  it("rejects oversized provider responses and decoded images", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("x".repeat(12 * 1024 * 1024 + 1), { status: 200 })),
    );
    await expect(generateImage({ prompt: "synthetic" })).rejects.toThrow(
      "Image generation returned an invalid response",
    );

    const oversizedBase64 = "A".repeat(Math.ceil((8 * 1024 * 1024 + 1) / 3) * 4);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ image: { b64Json: oversizedBase64, mimeType: "image/png" } }), { status: 200 }),
      ),
    );
    await expect(generateImage({ prompt: "synthetic" })).rejects.toThrow(
      "Image generation returned an invalid response",
    );
  });

  it("maps non-2xx and timeout failures without provider details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("provider-secret", { status: 502, statusText: "private status" })),
    );
    await expect(generateImage({ prompt: "synthetic" })).rejects.toThrow("Image generation request failed");
    await expect(generateImage({ prompt: "synthetic" })).rejects.not.toThrow("provider-secret");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timed out", "AbortError")));
    await expect(generateImage({ prompt: "synthetic" })).rejects.toThrow("Image generation request failed");
  });
});