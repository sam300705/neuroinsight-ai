import { afterEach, describe, expect, it, vi } from "vitest";
import { retryRouteImport } from "./routeImport";
afterEach(() => vi.useRealTimers());
describe("lazy-route recovery", () => {
  it("recovers a transient chunk failure with one retry and no page reload", async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch dynamically imported module: /assets/Analyse-old.js")).mockResolvedValueOnce({ default: "page" });
    const result = retryRouteImport(load);
    await vi.advanceTimersByTimeAsync(300);
    await expect(result).resolves.toEqual({ default: "page" });
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("stops after a second failure", async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockRejectedValue(new TypeError("Importing a module script failed"));
    const result = expect(retryRouteImport(load)).rejects.toThrow("Importing a module");
    await vi.advanceTimersByTimeAsync(300); await result;
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("does not retry application errors or successful imports", async () => {
    const failed = vi.fn().mockRejectedValue(new Error("Application bug"));
    await expect(retryRouteImport(failed)).rejects.toThrow("Application bug");
    expect(failed).toHaveBeenCalledOnce();
    const success = vi.fn().mockResolvedValue("page");
    await expect(retryRouteImport(success)).resolves.toBe("page");
    expect(success).toHaveBeenCalledOnce();
  });
});
