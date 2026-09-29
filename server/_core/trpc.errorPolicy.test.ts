import { describe, expect, it } from "vitest";
import {
  clientSafeTrpcMessage,
  GENERIC_INTERNAL_ERROR_MESSAGE,
} from "./trpc";

describe("tRPC client error policy", () => {
  it("replaces internal exception detail with a fixed message", () => {
    const message = clientSafeTrpcMessage(
      "INTERNAL_SERVER_ERROR",
      "mysql://user:private-password@private-host/patient-table"
    );

    expect(message).toBe(GENERIC_INTERNAL_ERROR_MESSAGE);
    expect(message).not.toContain("private");
    expect(message).not.toContain("patient");
  });

  it("preserves intentional non-internal procedure messages", () => {
    expect(
      clientSafeTrpcMessage(
        "SERVICE_UNAVAILABLE",
        "Scan history is temporarily unavailable."
      )
    ).toBe("Scan history is temporarily unavailable.");
  });
});
