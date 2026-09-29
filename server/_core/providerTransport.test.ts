import { afterEach, describe, expect, it, vi } from "vitest";
import { providerBaseUrl, providerFetch } from "./providerTransport";
import { ENV } from "./env";
import { callDataApi } from "./dataApi";
import { listLLMModels } from "./llm";
import { notifyOwner } from "./notification";
const original = { url: ENV.forgeApiUrl, key: ENV.forgeApiKey };
afterEach(() => { ENV.forgeApiUrl = original.url; ENV.forgeApiKey = original.key; vi.unstubAllGlobals(); });
describe("credentialed provider transport", () => {
  it.each(["", "http://forge.example", "//forge.example", "https://user:pass@forge.example", "https://forge.example?", "https://forge.example#", "https://forge.example\\path", "https://forge.\nexample"])("rejects unsafe configuration %s", raw => {
    expect(() => providerBaseUrl(raw)).toThrow(/^Provider configuration is invalid\.$/);
  });
  it("preserves an HTTPS base path", () => {
    expect(providerBaseUrl("https://forge.example/base/")).toBe("https://forge.example/base");
  });
  it("overrides a caller's redirect policy while preserving the signal and body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null)); vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    await providerFetch("https://forge.example/api", { method: "POST", body: "private", signal, redirect: "follow" });
    expect(fetchMock).toHaveBeenCalledWith("https://forge.example/api", { method: "POST", body: "private", signal, redirect: "error" });
  });
  it("rejects bad configured hosts in representative SDK integrations before fetch", async () => {
    ENV.forgeApiUrl = "https://user:pass@forge.example"; ENV.forgeApiKey = "test-only";
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(callDataApi("test")).rejects.toThrow();
    await expect(listLLMModels()).rejects.toThrow();
    await expect(notifyOwner({ title: "test", content: "test" })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
