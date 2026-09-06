import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./env";
import { invokeLLM, listLLMModels } from "./llm";

const originalForgeUrl = ENV.forgeApiUrl;
const originalForgeKey = ENV.forgeApiKey;

const validCompletion = {
  id: "completion-1",
  created: 1,
  model: "synthetic-model",
  choices: [{ index: 0, message: { role: "assistant", content: "synthetic answer" }, finish_reason: "stop" }],
};

const validModels = {
  object: "list",
  data: [{ id: "synthetic-model", object: "model", created: 1, owned_by: "synthetic" }],
};

describe("LLM boundary", () => {
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

  it("validates a completion response and passes an abort signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(validCompletion), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(invokeLLM({ messages: [{ role: "user", content: "hello" }] })).resolves.toEqual(validCompletion);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: expect.any(AbortSignal) });
  });

  it("rejects malformed, oversized, and schema-invalid completion responses safely", async () => {
    const bodies = [
      "not-json",
      JSON.stringify({ ...validCompletion, choices: [] }),
      JSON.stringify({ ...validCompletion, choices: [{ index: 0, message: { role: "assistant", content: 42 }, finish_reason: null }] }),
      "x".repeat(4 * 1024 * 1024 + 1),
    ];
    for (const body of bodies) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
      await expect(invokeLLM({ messages: [{ role: "user", content: "hello" }] })).rejects.toThrow("LLM invoke request failed");
    }
  });

  it("does not retry permanent client errors or expose provider details", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("provider-secret", { status: 400, statusText: "private" }));
    vi.stubGlobal("fetch", fetchMock);
    const error = await invokeLLM({ messages: [{ role: "user", content: "hello" }] }).catch(error => error as Error);
    expect(error.message).toBe("LLM invoke failed (400)");
    expect(error.message).not.toContain("provider-secret");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries selected transient statuses and validates the recovered response", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(validCompletion), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const request = invokeLLM({ messages: [{ role: "user", content: "hello" }] });
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(request).resolves.toEqual(validCompletion);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts a genuinely hanging request at the overall deadline", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "AbortError")));
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const request = invokeLLM({ messages: [{ role: "user", content: "hello" }] });
    const assertion = expect(request).rejects.toThrow("LLM invoke request failed");
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
  });

  it("validates the model list response and rejects malformed entries", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(validModels), { status: 200 })));
    await expect(listLLMModels()).resolves.toEqual(validModels);

    for (const body of [JSON.stringify({ data: [{}] }), JSON.stringify({ object: "list", data: Array.from({ length: 101 }, () => validModels.data[0]) })]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
      await expect(listLLMModels()).rejects.toThrow("List LLM models request failed");
    }
  });
});
