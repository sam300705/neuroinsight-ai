import axios from "axios";
import { SDKServer } from "./sdk";
import { ENV } from "./env";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeOAuthState, encodeOAuthState, AXIOS_TIMEOUT_MS } from "@shared/const";
import { oauthBaseUrl, oauthPost, oauthUserSchema, oauthTokenSchema, OAUTH_RESPONSE_LIMIT } from "./oauthBoundary";

const servers: Server[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => {
    server.closeAllConnections(); server.close(() => resolve());
  })));
});
const validUser = { openId: "user", projectId: "app", name: "User" };
async function serve(handler: Parameters<typeof createServer>[0]) {
  const server = createServer(handler); servers.push(server);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

describe("OAuth provider boundary", () => {
  it.each(["", "//provider.test", "http://provider.test", "https://user:pass@provider.test", "https://provider.test?q=x", "https://provider.test#x", "file:///tmp/x", " https://provider.test", "https://provider.test\\x"])("rejects unsafe base URL %s", value => {
    expect(() => oauthBaseUrl(value, true)).toThrow("configuration is invalid");
  });
  it("permits HTTPS and only loopback HTTP outside production", () => {
    expect(oauthBaseUrl("https://provider.test/", true)).toBe("https://provider.test");
    expect(oauthBaseUrl("http://127.0.0.1:1234", false)).toContain("127.0.0.1");
    expect(() => oauthBaseUrl("http://127.0.0.1:1234", true)).toThrow();
    expect(() => oauthBaseUrl("http://10.0.0.1", false)).toThrow();
  });
  it("validates a real HTTP JSON response and strips unknown provider fields", async () => {
    const url = await serve((_req, res) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ ...validUser, secret: "do-not-return" })); });
    await expect(oauthPost(axios.create(), url, false, "/info", {}, oauthUserSchema)).resolves.toEqual(validUser);
  });
  it.each(["malformed", "oversize", "wrong-schema", "non-success"])("rejects %s HTTP responses with a fixed error", async kind => {
    const url = await serve((_req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (kind === "non-success") res.statusCode = 503;
      res.end(kind === "malformed" ? '{private-provider-detail' : kind === "oversize" ? JSON.stringify({ data: "x".repeat(OAUTH_RESPONSE_LIMIT) }) : JSON.stringify({ private: "provider-detail" }));
    });
    await expect(oauthPost(axios.create(), url, false, "/info", {}, oauthUserSchema)).rejects.toThrow(/^OAuth provider request failed\.$/);
  });
  it("does not follow redirects or forward credentials to the redirect target", async () => {
    const target = vi.fn((_req, res) => res.end(JSON.stringify(validUser)));
    const targetUrl = await serve(target);
    const url = await serve((_req, res) => { res.writeHead(307, { Location: targetUrl }); res.end(); });
    await expect(oauthPost(axios.create(), url, false, "/info", { accessToken: "private" }, oauthUserSchema)).rejects.toThrow("OAuth provider request failed.");
    expect(target).not.toHaveBeenCalled();
  });
  it("rejects oversized requests before any provider call", async () => {
    const post = vi.fn();
    await expect(oauthPost({ post } as never, "https://provider.test", true, "/info", { data: "x".repeat(40000) }, oauthUserSchema)).rejects.toThrow("OAuth provider request failed.");
    expect(post).not.toHaveBeenCalled();
  });
  it("aborts a genuinely pending provider adapter on the total deadline", async () => {
    vi.useFakeTimers();
    // Node's native AbortSignal.timeout uses internal timers; substitute its
    // scheduling only, while exercising the actual pending request cancellation.
    vi.spyOn(AbortSignal, "timeout").mockImplementation(ms => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), ms); return controller.signal;
    });
    const client = axios.create({ adapter: config => new Promise((_resolve, reject) => {
      config.signal!.addEventListener!("abort", () => reject(new Error("private timeout detail")));
    }) });
    const result = expect(oauthPost(client, "https://provider.test", true, "/info", {}, oauthUserSchema)).rejects.toThrow(/^OAuth provider request failed\.$/);
    await vi.advanceTimersByTimeAsync(AXIOS_TIMEOUT_MS); await result;
  });
  it("rejects malformed identity and credential fields", () => {
    for (const value of ["", " ", 4, "x".repeat(8193)]) expect(oauthTokenSchema.safeParse({ accessToken: value }).success).toBe(false);
    expect(oauthUserSchema.safeParse({ ...validUser, openId: " " }).success).toBe(false);
    expect(oauthUserSchema.safeParse({ ...validUser, platforms: Array(33).fill("email") }).success).toBe(false);
  });
  it("keeps state fields bounded and does not return unrecognized properties", () => {
    const state = { redirectUri: "https://dashboard.test/api/oauth/callback", nonce: "n".repeat(36) };
    expect(decodeOAuthState(encodeOAuthState({ ...state, extra: "private" } as never))).toEqual(state);
    expect(decodeOAuthState("x".repeat(8193))).toEqual({ redirectUri: "" });
    expect(decodeOAuthState(encodeOAuthState({ ...state, nonce: "x".repeat(129) })).nonce).toBeUndefined();
  });
});


describe("SDK provider integration contract", () => {
  it("preserves validated login platforms and rejects another project", async () => {
    const originalUrl = ENV.oAuthServerUrl;
    ENV.oAuthServerUrl = "https://provider.test";
    try {
      const post = vi.fn().mockResolvedValue({ status: 200, data: { ...validUser, platforms: ["REGISTERED_PLATFORM_GOOGLE"] } });
      const sdk = new SDKServer({ post } as never, { appId: "app", secret: "x".repeat(32), production: true });
      await expect(sdk.getUserInfo("access-token")).resolves.toMatchObject({ openId: "user", loginMethod: "google" });
      post.mockResolvedValue({ status: 200, data: { ...validUser, projectId: "other" } });
      await expect(sdk.getUserInfo("access-token")).rejects.toThrow("identity mismatch");
      await expect(sdk.getUserInfoWithJwt("jwt-token")).rejects.toThrow("identity mismatch");
    } finally { ENV.oAuthServerUrl = originalUrl; }
  });
  it("rejects unbounded codes and invalid callback state before sending credentials", async () => {
    const post = vi.fn();
    const sdk = new SDKServer({ post } as never, { appId: "app", secret: "x".repeat(32), production: true });
    await expect(sdk.exchangeCodeForToken("x".repeat(8193), "state")).rejects.toThrow();
    for (const redirectUri of ["https://user:pass@dashboard.test/api/oauth/callback", "https://dashboard.test/elsewhere", "javascript:alert(1)"]) {
      await expect(sdk.exchangeCodeForToken("code", encodeOAuthState({ redirectUri, nonce: "n".repeat(36) }))).rejects.toThrow();
    }
    expect(post).not.toHaveBeenCalled();
  });
});
