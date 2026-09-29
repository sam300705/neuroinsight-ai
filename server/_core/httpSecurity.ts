import type { Response } from "express";

export const MAX_TRPC_BODY_SIZE = "16mb";
export const REQUEST_TIMEOUT_MS = 45_000;
export const HEADERS_TIMEOUT_MS = 35_000;
export const KEEP_ALIVE_TIMEOUT_MS = 5_000;

function optionalHttpsOrigin(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

/** Applies browser protections that do not require a new runtime dependency. */
export function applyHttpSecurityHeaders(response: Pick<Response, "setHeader">, production: boolean) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  if (production) {
    const inferenceOrigin = optionalHttpsOrigin(process.env.VITE_INFERENCE_API_BASE_URL);
    response.setHeader("Content-Security-Policy", [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      `connect-src 'self'${inferenceOrigin ? ` ${inferenceOrigin}` : ""}`,
    ].join("; "));
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}
