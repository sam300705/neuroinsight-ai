import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./env";

vi.mock("server/storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "/manus-storage/generated/test.png" }),
}));

import { storagePut } from "server/storage";
import { generateImage, listImageModels } from "./imageGeneration";

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
    const rejection = generateImage({ prompt: "synthetic" });
    await expect(rejection).rejects.toThrow("Image generation request failed");
    await expect(rejection).rejects.not.toThrow("provider-secret");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timed out", "AbortError")));
    await expect(generateImage({ prompt: "synthetic" })).rejects.toThrow("Image generation request failed");
  });

  it("lists bounded, meaningful image models", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ models: [{ model: "MODEL_GPT_IMAGE_2", id: "gpt-image-2" }] }), { status: 200 }),
      ),
    );
    await expect(listImageModels()).resolves.toEqual({ models: [{ model: "MODEL_GPT_IMAGE_2", id: "gpt-image-2" }] });
  });

  it("rejects malformed, oversized, and meaningless model lists", async () => {
    const bodies = [
      "not-json",
      JSON.stringify({}),
      JSON.stringify({ models: "wrong" }),
      JSON.stringify({ models: [{}] }),
      JSON.stringify({ models: [{ model: "   " }] }),
      JSON.stringify({ models: [{ id: "x".repeat(257) }] }),
      JSON.stringify({ models: Array.from({ length: 101 }, (_, index) => ({ id: `model-${index}` })) }),
    ];
    for (const body of bodies) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
      await expect(listImageModels()).rejects.toThrow("Image model listing returned an invalid response");
    }
  });

  it("maps model-list provider failures without leaking details or waiting for a timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("model-provider-secret", { status: 502 })));
    const rejection = listImageModels();
    const error = await rejection.catch(error => error as Error);
    expect(error.message).toBe("Image model listing request failed");
    expect(error.message).not.toContain("model-provider-secret");

    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "AbortError")));
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const hangingRequest = listImageModels();
    const hangingAssertion = expect(hangingRequest).rejects.toThrow("Image model listing request failed");
    await vi.advanceTimersByTimeAsync(30_000);
    await hangingAssertion;
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: expect.any(AbortSignal) });
    vi.useRealTimers();
  });

  it("aborts a genuinely hanging image request at its deadline", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "AbortError")));
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const hangingRequest = generateImage({ prompt: "synthetic" });
    const hangingAssertion = expect(hangingRequest).rejects.toThrow("Image generation request failed");
    await vi.advanceTimersByTimeAsync(30_000);
    await hangingAssertion;
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: expect.any(AbortSignal) });
    vi.useRealTimers();
  });
});