// Preconfigured storage helpers for Manus WebDev templates
// Uploads via Forge Server presigned URL to S3 (PUT direct).
// Downloads return /manus-storage/{key} paths served via 307 redirect.

import { ENV } from "./_core/env";

const PROVIDER_CONTROL_TIMEOUT_MS = 10_000;
const OBJECT_UPLOAD_TIMEOUT_MS = 30_000;

function requireHttpsProviderUrl(value: unknown, purpose: string): string {
  if (typeof value !== "string" || !value) {
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

  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string): string {
  const key = relKey.replace(/^\/+/, "");
  const segments = key.split("/");
  if (!key || segments.some(segment => !segment || segment === "." || segment === "..") || /[\\\0\r\n]/.test(key)) {
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

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
    signal: AbortSignal.timeout(PROVIDER_CONTROL_TIMEOUT_MS),
  });

  if (!presignResp.ok) {
    throw new Error(`Storage presign failed (${presignResp.status})`);
  }

  const presignPayload = (await presignResp.json()) as { url?: unknown };
  const s3Url = requireHttpsProviderUrl(presignPayload?.url, "Storage presign service");

  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
    signal: AbortSignal.timeout(OBJECT_UPLOAD_TIMEOUT_MS),
  });

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

  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
    signal: AbortSignal.timeout(PROVIDER_CONTROL_TIMEOUT_MS),
  });

  if (!resp.ok) {
    throw new Error(`Storage signed URL failed (${resp.status})`);
  }

  const payload = (await resp.json()) as { url?: unknown };
  return requireHttpsProviderUrl(payload?.url, "Storage download service");
}

/** Physically removes a derived object; missing objects are treated as deleted. */
export async function storageDelete(relKey: string): Promise<void> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeKey(relKey);
  const deleteUrl = new URL("v1/storage/delete", forgeUrl + "/");
  deleteUrl.searchParams.set("path", key);
  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${forgeKey}` },
    signal: AbortSignal.timeout(PROVIDER_CONTROL_TIMEOUT_MS),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Storage deletion failed (${response.status})`);
  }
}
