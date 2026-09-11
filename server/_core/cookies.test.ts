import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { getSessionCookieOptions } from "./cookies";

const request = (protocol: string, forwardedProto?: string) =>
  ({
    protocol,
    headers: forwardedProto ? { "x-forwarded-proto": forwardedProto } : {},
  }) as Request;

describe("session cookie transport policy", () => {
  it("uses cross-site secure cookies for direct HTTPS", () => {
    expect(getSessionCookieOptions(request("https"), false)).toEqual({
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
    });
  });

  it("does not trust caller-supplied forwarding headers", () => {
    expect(
      getSessionCookieOptions(request("http", "https, http"), false)
    ).toEqual({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    });
  });

  it("always emits secure cookies under the production HTTPS contract", () => {
    expect(getSessionCookieOptions(request("http"), true)).toEqual({
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
    });
  });
});
