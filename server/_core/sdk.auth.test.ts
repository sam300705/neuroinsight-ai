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
