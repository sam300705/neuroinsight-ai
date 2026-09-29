import type { CookieOptions, Request } from "express";
import { ENV } from "./env";

export function getSessionCookieOptions(
  req: Request,
  production = ENV.isProduction
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // Production is HTTPS-only by deployment contract. Do not inspect
  // X-Forwarded-Proto here: Express does not trust a proxy by default, and a
  // caller-controlled forwarding header must not change cookie policy.
  const secure = production || req.protocol === "https";

  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure,
  };
}
