import { afterEach, describe, expect, it, vi } from "vitest";
import { TRPCClientError } from "@trpc/client";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { handleApiError } from "./apiErrorPolicy";
afterEach(() => vi.restoreAllMocks());
describe("browser API error policy", () => {
  it.each(["query", "mutation"] as const)("does not log %s error data", operation => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const login = vi.fn();
    handleApiError(Object.assign(new Error("private-token"), { data: { patient: "private" } }), operation, login);
    expect(log.mock.calls).toEqual([[operation === "query" ? "[API] Query failed." : "[API] Mutation failed."]]);
    expect(login).not.toHaveBeenCalled();
  });
  it("retains the existing unauthorized redirect", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const login = vi.fn();
    handleApiError(new TRPCClientError(UNAUTHED_ERR_MSG), "query", login);
    expect(login).toHaveBeenCalledOnce();
  });
});
