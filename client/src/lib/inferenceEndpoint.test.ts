import { describe, expect, it } from "vitest";

describe("configured inference endpoint", () => {
  it("returns a healthy response from the configured validation service", async () => {
    const base = process.env.VITE_INFERENCE_API_BASE_URL;
    expect(base).toBeTruthy();
    const response = await fetch(`${base!.replace(/\/$/, "")}/health`);
    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toMatchObject({ status: "ok", service: "neuroinsight-inference" });
  }, 15_000);
});
