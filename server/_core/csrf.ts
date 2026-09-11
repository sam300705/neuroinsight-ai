import type { NextFunction, Request, Response } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isTrustedMutationOrigin(origin: string | undefined, host: string | undefined) {
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.host === host;
  } catch {
    return false;
  }
}

/**
 * Cookie-authenticated browser mutations must originate from this dashboard.
 * Requests without a session cookie continue to reach tRPC, where protected
 * procedures reject them normally; this avoids blocking public infrastructure
 * probes while making cookie CSRF fail closed.
 */
export function csrfSameOriginGuard(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method) || !req.headers.cookie) {
    next();
    return;
  }

  if (!isTrustedMutationOrigin(req.get("origin"), req.get("host"))) {
    res.status(403).json({ error: "Cross-site mutation blocked" });
    return;
  }

  next();
}
