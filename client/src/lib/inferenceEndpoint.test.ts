import { afterEach, describe, expect, it, vi } from "vitest";
import { validateWithInferenceService } from "./inferenceApi";

describe("configured inference endpoint", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails closed without an inference-service configuration and does not submit the upload", async () => {
    vi.stubEnv("VITE_INFERENCE_API_BASE_URL", "");
    const fetchImpl = vi.fn();
    const result = await validateWithInferenceService(
      new File(["test"], "scan.jpg", { type: "image/jpeg" }),
      "classification",
      "request-1",
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("not configured") });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
