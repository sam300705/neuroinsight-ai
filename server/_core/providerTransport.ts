/** Shared transport policy for credential-bearing dormant Forge helpers. */
export function providerBaseUrl(raw: string): string {
  try {
    if (!raw || raw.length > 4096 || /\s/.test(raw) || /[?#\\]/.test(raw)) throw new Error();
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    return url.href.replace(/\/+$/, "");
  } catch {
    throw new Error("Provider configuration is invalid.");
  }
}

export function providerFetch(url: string | URL, init: RequestInit): Promise<Response> {
  // Provider API calls have no legitimate cross-origin redirect requirement.
  // Keep the caller's body/deadline and force credential-forwarding refusal.
  return fetch(url, { ...init, redirect: "error" });
}
