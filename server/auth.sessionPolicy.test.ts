import { describe, expect, it } from "vitest";
import { SESSION_MAX_AGE_MS } from "../shared/const";

describe("session lifetime policy", () => {
  it("bounds newly issued sessions to seven days", () => {
    expect(SESSION_MAX_AGE_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
