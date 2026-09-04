import { describe, expect, it } from "vitest";
import { MINIMUM_PRODUCTION_SESSION_SECRET_BYTES, sessionSecretBytes } from "./authConfig";

describe("session signing configuration", () => {
  it.each([undefined, "", "   "])("rejects an absent session secret: %j", value => {
    expect(() => sessionSecretBytes(value, false)).toThrow("JWT_SECRET must be configured");
  });

  it("requires at least 32 UTF-8 bytes in production", () => {
    expect(() => sessionSecretBytes("x".repeat(31), true)).toThrow("at least 32 UTF-8 bytes");
    expect(sessionSecretBytes("x".repeat(32), true)).toHaveLength(MINIMUM_PRODUCTION_SESSION_SECRET_BYTES);
  });

  it("measures encoded bytes rather than JavaScript characters", () => {
    expect(sessionSecretBytes("🔒".repeat(8), true)).toHaveLength(32);
  });

  it("allows an explicitly configured development-only secret without applying the production minimum", () => {
    expect(new TextDecoder().decode(sessionSecretBytes("local-only", false))).toBe("local-only");
  });
});
