import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { SDKServer } from "./sdk";

afterEach(() => vi.restoreAllMocks());

describe("authenticated request persistence", () => {
  it("does not write lastSignedIn on every request for an existing session", async () => {
    const existingUser: User = {
      id: 7,
      openId: "existing-user",
      email: "existing@example.com",
      name: "Existing User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const service = new SDKServer({ post: vi.fn() } as never);
    vi.spyOn(service, "verifySession").mockResolvedValue({ openId: existingUser.openId, appId: "app", name: existingUser.name ?? "User" });
    vi.spyOn(db, "getUserByOpenId").mockResolvedValue(existingUser);
    const upsert = vi.spyOn(db, "upsertUser").mockResolvedValue();

    const user = await service.authenticateRequest({ headers: { cookie: "app_session_id=opaque-session" } } as Request);

    expect(user).toBe(existingUser);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("session application binding", () => {
  const secret = "s".repeat(32);

  function service(appId: string) {
    return new SDKServer({ post: vi.fn() } as never, { appId, secret, production: true });
  }

  it("round-trips a session issued for the configured application", async () => {
    const dashboard = service("neuroinsight-dashboard");
    const token = await dashboard.createSessionToken("user-1", { name: "User" });

    await expect(dashboard.verifySession(token)).resolves.toEqual({
      openId: "user-1",
      appId: "neuroinsight-dashboard",
      name: "User",
    });
  });

  it("rejects a validly signed session issued for another application", async () => {
    const issuer = service("other-dashboard");
    const verifier = service("neuroinsight-dashboard");
    const token = await issuer.createSessionToken("user-1", { name: "User" });

    await expect(verifier.verifySession(token)).resolves.toBeNull();
  });

  it("refuses to sign a caller-supplied payload for another application", async () => {
    const dashboard = service("neuroinsight-dashboard");

    await expect(
      dashboard.signSession({ openId: "user-1", appId: "other-dashboard", name: "User" }),
    ).rejects.toThrow("does not match this dashboard");
  });
});
