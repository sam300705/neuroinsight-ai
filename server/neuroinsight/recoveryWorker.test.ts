import { afterEach, describe, expect, it, vi } from "vitest";
import { startArtifactReconciliationWorker } from "./recoveryWorker";

afterEach(() => {
  vi.useRealTimers();
});

describe("artifact reconciliation worker scheduling", () => {
  it("does not start when required infrastructure is not configured", async () => {
    const runBatch = vi.fn(async () => undefined);
    const stop = startArtifactReconciliationWorker({
      configured: () => false,
      runBatch,
    });

    await Promise.resolve();
    expect(runBatch).not.toHaveBeenCalled();
    stop();
  });

  it("runs immediately, repeats on a bounded interval, and stops cleanly", async () => {
    vi.useFakeTimers();
    const runBatch = vi.fn(async () => undefined);
    const stop = startArtifactReconciliationWorker({
      configured: () => true,
      runBatch,
      intervalMs: 1_000,
      onError: vi.fn(),
    });

    await Promise.resolve();
    expect(runBatch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(runBatch).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(runBatch).toHaveBeenCalledTimes(2);
  });

  it("never overlaps sweeps when a previous batch is still running", async () => {
    vi.useFakeTimers();
    let release: (() => void) | undefined;
    const runBatch = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
    const stop = startArtifactReconciliationWorker({
      configured: () => true,
      runBatch,
      intervalMs: 1_000,
      onError: vi.fn(),
    });

    await Promise.resolve();
    expect(runBatch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(runBatch).toHaveBeenCalledTimes(1);

    release?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runBatch).toHaveBeenCalledTimes(2);
    stop();
  });
});
