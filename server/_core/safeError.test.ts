import { describe, expect, it } from "vitest";
import { safeErrorMetadata } from "./safeError";

describe("safe operational error metadata", () => {
  it.each([
    [new TypeError("database password=private"), "TypeError"],
    [new Error("signed URL and patient detail"), "Error"],
    ["raw provider response", "UnknownError"],
  ])(
    "classifies failures without returning their detail",
    (failure, expectedType) => {
      const metadata = safeErrorMetadata(failure);

      expect(metadata).toEqual({ errorType: expectedType });
      expect(JSON.stringify(metadata)).not.toContain("private");
      expect(JSON.stringify(metadata)).not.toContain("patient");
      expect(JSON.stringify(metadata)).not.toContain("provider response");
    }
  );

  it("does not trust a custom error name as log-safe data", () => {
    const failure = new Error("private detail");
    failure.name = "credential=secret";

    expect(safeErrorMetadata(failure)).toEqual({ errorType: "Error" });
  });

  it("handles an error whose name accessor throws", () => {
    const failure = new Error("private detail");
    Object.defineProperty(failure, "name", {
      get: () => {
        throw new Error("secret from getter");
      },
    });

    expect(safeErrorMetadata(failure)).toEqual({ errorType: "Error" });
  });
});
