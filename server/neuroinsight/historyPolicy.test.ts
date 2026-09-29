import { describe, expect, it } from "vitest";
import { ACTIVE_HISTORY_MODE, historyListInputSchema } from "./historyPolicy";

describe("history listing policy", () => {
  it("is permanently scoped to the deployed Mode A classification history", () => {
    expect(ACTIVE_HISTORY_MODE).toBe("classification");
    expect(historyListInputSchema.parse({})).toEqual({ limit: 20 });
  });

  it("rejects a crafted Mode B list filter instead of silently exposing legacy records", () => {
    expect(() => historyListInputSchema.parse({ mode: "segmentation" })).toThrow();
  });
});
