import { describe, expect, it, vi } from "vitest";
import { clearLegacyRuntimeUserInfo } from "./useAuth";

describe("auth browser privacy", () => {
  it("removes account data persisted by older dashboard builds", () => {
    const removeItem = vi.fn();

    clearLegacyRuntimeUserInfo({ removeItem });

    expect(removeItem).toHaveBeenCalledWith("manus-runtime-user-info");
  });

  it("does not crash when persistent browser storage is blocked", () => {
    expect(() => clearLegacyRuntimeUserInfo({ removeItem: () => { throw new Error("blocked"); } })).not.toThrow();
  });
});
