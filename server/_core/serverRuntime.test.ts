import { afterEach, describe, expect, it, vi } from "vitest";
import { configuredPort, findAvailableDevelopmentPort, selectServerPort, startupFailureEvent } from "./serverRuntime";

describe("server runtime configuration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a bounded integer port and defaults when it is absent", () => {
    expect(configuredPort(undefined)).toBe(3000);
    expect(configuredPort(" 4173 ")).toBe(4173);
  });

  it.each(["0", "65536", "3000.5", "3000x", "-1"])("rejects invalid PORT value %s", value => {
    expect(() => configuredPort(value)).toThrow("PORT must be an integer between 1 and 65535.");
  });

  it("uses a bounded alternate-port search for development", async () => {
    const isAvailable = vi.fn(async (port: number) => port === 3002);

    await expect(findAvailableDevelopmentPort(3000, isAvailable)).resolves.toBe(3002);
    expect(isAvailable.mock.calls.map(([port]) => port)).toEqual([3000, 3001, 3002]);
  });

  it("uses the exact assigned production port without probing alternatives", async () => {
    const isAvailable = vi.fn(async () => false);

    await expect(selectServerPort(4173, true, isAvailable)).resolves.toBe(4173);
    expect(isAvailable).not.toHaveBeenCalled();
  });

  it("fails when the development search range is exhausted", async () => {
    const isAvailable = vi.fn(async () => false);

    await expect(findAvailableDevelopmentPort(65_535, isAvailable, 2)).rejects.toThrow(
      "No development port is available",
    );
    expect(isAvailable).toHaveBeenCalledTimes(1);
  });

  it("records only the startup error type", () => {
    const privateMessage = "secret database or environment detail";

    const event = startupFailureEvent(new TypeError(privateMessage));

    expect(event).toBe("server_start_failed:error_type=TypeError");
    expect(event).not.toContain(privateMessage);
    expect(startupFailureEvent(privateMessage)).toBe("server_start_failed:error_type=UnknownError");
  });
});
