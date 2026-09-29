import { describe, expect, it, vi } from "vitest";
import { csrfSameOriginGuard, isTrustedMutationOrigin } from "./csrf";

function invoke(input: { method?: string; cookie?: string; origin?: string; host?: string }) {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn();
  const next = vi.fn();
  csrfSameOriginGuard({
    method: input.method ?? "POST",
    headers: input.cookie ? { cookie: input.cookie } : {},
    get: (name: string) => name === "origin" ? input.origin : name === "host" ? input.host : undefined,
  } as never, { status, json } as never, next);
  return { status, json, next };
}

describe("csrfSameOriginGuard", () => {
  it("accepts same-origin cookie-authenticated mutations", () => {
    const result = invoke({ cookie: "session=1", origin: "https://neuroaiapp.example", host: "neuroaiapp.example" });
    expect(result.next).toHaveBeenCalledOnce();
    expect(result.status).not.toHaveBeenCalled();
  });

  it("rejects cross-origin and missing-origin cookie mutations", () => {
    for (const origin of ["https://attacker.example", undefined]) {
      const result = invoke({ cookie: "session=1", origin, host: "neuroaiapp.example" });
      expect(result.status).toHaveBeenCalledWith(403);
      expect(result.json).toHaveBeenCalledWith({ error: "Cross-site mutation blocked" });
      expect(result.next).not.toHaveBeenCalled();
    }
  });

  it("allows safe methods and requests without cookie authentication", () => {
    expect(invoke({ method: "GET", cookie: "session=1", host: "neuroaiapp.example" }).next).toHaveBeenCalledOnce();
    expect(invoke({ origin: "https://attacker.example", host: "neuroaiapp.example" }).next).toHaveBeenCalledOnce();
  });

  it("only trusts matching HTTP(S) origins", () => {
    expect(isTrustedMutationOrigin("https://example.test", "example.test")).toBe(true);
    expect(isTrustedMutationOrigin("file:///tmp/page.html", "example.test")).toBe(false);
    expect(isTrustedMutationOrigin("https://other.test", "example.test")).toBe(false);
  });
});
