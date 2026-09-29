import type { AxiosInstance } from "axios";
import { z } from "zod";
import { AXIOS_TIMEOUT_MS } from "@shared/const";

export const OAUTH_RESPONSE_LIMIT = 128 * 1024;
export const OAUTH_REQUEST_LIMIT = 32 * 1024;
export const oauthCredential = z.string().min(1).max(8192).refine(v => v.trim().length > 0);
const identity = z.string().min(1).max(255).refine(v => v.trim().length > 0);
export const oauthTokenSchema = z.object({
  accessToken: oauthCredential,
  tokenType: z.string().max(64).default(""),
  expiresIn: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
  refreshToken: oauthCredential.optional(),
  scope: z.string().max(4096).default(""),
  idToken: z.string().max(16384).default(""),
});
export const oauthUserSchema = z.object({
  openId: identity,
  projectId: identity,
  name: z.string().max(255),
  email: z.string().max(320).nullable().optional(),
  platform: z.string().max(64).nullable().optional(),
  loginMethod: z.string().max(64).nullable().optional(),
  platforms: z.array(z.string().max(64)).max(32).optional(),
  taskUid: identity.nullable().optional(),
});

export function oauthBaseUrl(raw: string, production: boolean): string {
  try {
    if (!raw || /\s/.test(raw) || raw.includes("?") || raw.includes("#") || raw.includes("\\")) throw new Error();
    const url = new URL(raw);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash ||
        !(url.protocol === "https:" || (!production && loopback && url.protocol === "http:"))) {
      throw new Error();
    }
    return url.href.replace(/\/$/, "");
  } catch {
    throw new Error("OAuth provider configuration is invalid.");
  }
}

// Reject provider exceptions without copying Axios request config, headers or body.
// Both the transport and the post-parse check are bounded; the latter also covers
// injected adapters. No redirects may forward authorization material elsewhere.
export async function oauthPost<T>(
  client: AxiosInstance, baseUrl: string, production: boolean,
  path: string, payload: unknown, schema: z.ZodType<T>,
): Promise<T> {
  try {
    const baseURL = oauthBaseUrl(baseUrl, production);
    if (Buffer.byteLength(JSON.stringify(payload), "utf8") > OAUTH_REQUEST_LIMIT) throw new Error();
    const { data, status } = await client.post(path, payload, {
      baseURL,
      timeout: AXIOS_TIMEOUT_MS,
      signal: AbortSignal.timeout(AXIOS_TIMEOUT_MS),
      maxRedirects: 0,
      maxContentLength: OAUTH_RESPONSE_LIMIT,
      maxBodyLength: OAUTH_REQUEST_LIMIT,
      responseType: "json",
      transitional: { silentJSONParsing: false },
      validateStatus: status => status >= 200 && status < 300,
    });
    if (status < 200 || status >= 300 ||
        Buffer.byteLength(JSON.stringify(data), "utf8") > OAUTH_RESPONSE_LIMIT) throw new Error();
    return schema.parse(data);
  } catch {
    throw new Error("OAuth provider request failed.");
  }
}
