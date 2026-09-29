// Preconfigured storage helpers for Manus WebDev templates
// Uploads via Forge Server presigned URL to S3 (PUT direct).
// Downloads return /manus-storage/{key} paths served via 307 redirect.

import { ENV } from "./_core/env";

const PROVIDER_CONTROL_TIMEOUT_MS = 10_000;
const OBJECT_UPLOAD_TIMEOUT_MS = 30_000;
const MAX_CONTROL_RESPONSE_BYTES = 64 * 1024;

async function storageFetch(url: URL | string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...options, redirect: "error" });
  } catch {
    throw new Error("Storage provider request failed");
  }
}

async function discardBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

async function readControlJson(response: Response): Promise<{ url?: unknown }> {
  const reader = response.body?.getReader();
  try {
    const declared = response.headers.get("content-length");
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_CONTROL_RESPONSE_BYTES)) throw new Error();
    if (!reader) throw new Error();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0;
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_CONTROL_RESPONSE_BYTES) throw new Error();
      text += decoder.decode(value, { stream: true });
    }
    const payload = JSON.parse(text + decoder.decode());
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
    return payload;
  } catch {
    throw new Error("Storage provider returned an invalid response");
  } finally {
    await reader?.cancel().catch(() => undefined);
    reader?.releaseLock();
  }
}

function requireHttpsProviderUrl(value: unknown, purpose: string): string {
  if (typeof value !== "string" || !value || value.length > 8192 || /\s/.test(value) || value.includes("#") || value.includes("\\")) {
    throw new Error(`${purpose} returned an invalid URL`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${purpose} returned an invalid URL`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error(`${purpose} returned an invalid URL`);
  }
  return parsed.toString();
}

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY",
    );
  }

  const validatedUrl = requireHttpsProviderUrl(forgeUrl, "Storage configuration");
  if (forgeUrl.includes("?") || !forgeKey.trim()) throw new Error("Storage configuration is invalid");
  return { forgeUrl: validatedUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string): string {
  const key = relKey.replace(/^\/+/, "");
  const segments = key.split("/");
  if (!key || key.length > 512 || segments.some(segment => !segment || segment === "." || segment === "..") || /[\\\0\r\n]/.test(key)) {
    throw new Error("Storage key is invalid");
  }
  return key;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

async function storagePutAtResolvedKey(
  key: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
): Promise<{ key: string; url: string }> {
  const { forgeUrl, forgeKey } = getForgeConfig();

  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);

  const presignResp = await storageFetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
    signal: AbortSignal.timeout(PROVIDER_CONTROL_TIMEOUT_MS),
  });

  if (!presignResp.ok) {
    await discardBody(presignResp);
    throw new Error(`Storage presign failed (${presignResp.status})`);
  }

  const presignPayload = await readControlJson(presignResp);
  const s3Url = requireHttpsProviderUrl(presignPayload?.url, "Storage presign service");

  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await storageFetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
    signal: AbortSignal.timeout(OBJECT_UPLOAD_TIMEOUT_MS),
  });

  await discardBody(uploadResp);
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }

  return { key, url: `/manus-storage/${key}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  return storagePutAtResolvedKey(key, data, contentType);
}

/** Idempotent overwrite used only for an owned scan's single artifact slot. */
export async function storagePutStable(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  return storagePutAtResolvedKey(normalizeKey(relKey), data, contentType);
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeKey(relKey);

  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);

  const resp = await storageFetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
    signal: AbortSignal.timeout(PROVIDER_CONTROL_TIMEOUT_MS),
  });

  if (!resp.ok) {
    await discardBody(resp);
    throw new Error(`Storage signed URL failed (${resp.status})`);
  }

  const payload = await readControlJson(resp);
  return requireHttpsProviderUrl(payload?.url, "Storage download service");
}

/** Physically removes a derived object; missing objects are treated as deleted. */
export async function storageDelete(relKey: string): Promise<void> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeKey(relKey);
  const deleteUrl = new URL("v1/storage/delete", forgeUrl + "/");
  deleteUrl.searchParams.set("path", key);
  const response = await storageFetch(deleteUrl, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${forgeKey}` },
    signal: AbortSignal.timeout(PROVIDER_CONTROL_TIMEOUT_MS),
  });
  await discardBody(response);
  if (!response.ok && response.status !== 404) {
    throw new Error(`Storage deletion failed (${response.status})`);
  }
}
