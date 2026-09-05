import { describe, expect, it } from "vitest";
import { applyHttpSecurityHeaders } from "./httpSecurity";

describe("HTTP security headers", () => {
  it("sets baseline browser protections without production-only HSTS in development", () => {
    const headers = new Map<string, string>();
    applyHttpSecurityHeaders({ setHeader: (name, value) => { headers.set(name, String(value)); return undefined; } }, false);
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.has("Strict-Transport-Security")).toBe(false);
  });

  it("adds HSTS only in production", () => {
    const headers = new Map<string, string>();
    applyHttpSecurityHeaders({ setHeader: (name, value) => { headers.set(name, String(value)); return undefined; } }, true);
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
    expect(headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(headers.get("Content-Security-Policy")).toContain("object-src 'none'");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });
});
