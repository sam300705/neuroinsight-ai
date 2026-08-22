import { describe, expect, it } from "vitest";
import { deleteAllOwnedScans, deleteOwnedScan, issueOwnedArtifactDownload } from "./artifactLifecycle";

describe("artifact lifecycle ownership boundaries", () => {
  it("does not sign a download for an artifact outside the authenticated user scope", async () => {
    let signerCalls = 0;
    await expect(issueOwnedArtifactDownload(2, 7, {
      findOwnedArtifact: async () => undefined,
      createSignedUrl: async () => { signerCalls += 1; return "https://example.invalid/signed"; },
    })).rejects.toThrow("Artifact was not found for this user.");
    expect(signerCalls).toBe(0);
  });

  it("returns a fresh signed URL only after an owned artifact lookup", async () => {
    const signedKeys: string[] = [];
    const result = await issueOwnedArtifactDownload(1, 7, {
      findOwnedArtifact: async (userId, artifactId) => userId === 1 && artifactId === 7 ? { id: 7, artifactType: "report", storageKey: "neuroinsight/1/scan/report.pdf" } : undefined,
      createSignedUrl: async key => { signedKeys.push(key); return `https://example.invalid/fresh/${signedKeys.length}`; },
    });
    expect(result.storageUrl).toBe("https://example.invalid/fresh/1");
    expect(signedKeys).toEqual(["neuroinsight/1/scan/report.pdf"]);
  });

  it("does not delete metadata when the scan is not owned by the authenticated user", async () => {
    const calls: string[] = [];
    const result = await deleteOwnedScan(2, "scan-1", {
      findOwnedScan: async () => undefined,
      deleteArtifactMetadata: async id => { calls.push(`artifacts:${id}`); },
      deleteScanMetadata: async id => { calls.push(`scan:${id}`); },
    });
    expect(result).toEqual({ deleted: false });
    expect(calls).toEqual([]);
  });

  it("removes owned artifact metadata before its scan metadata", async () => {
    const calls: string[] = [];
    const result = await deleteOwnedScan(1, "scan-1", {
      findOwnedScan: async (userId, scanId) => userId === 1 && scanId === "scan-1" ? { id: 14 } : undefined,
      deleteArtifactMetadata: async id => { calls.push(`artifacts:${id}`); },
      deleteScanMetadata: async id => { calls.push(`scan:${id}`); },
    });
    expect(result).toEqual({ deleted: true });
    expect(calls).toEqual(["artifacts:14", "scan:14"]);
  });

  it("purges only the current user's listed metadata records", async () => {
    const calls: string[] = [];
    const result = await deleteAllOwnedScans(3, {
      listOwnedScanIds: async userId => userId === 3 ? [4, 9] : [],
      deleteArtifactMetadata: async id => { calls.push(`artifacts:${id}`); },
      deleteAllScanMetadata: async userId => { calls.push(`records:${userId}`); },
    });
    expect(result).toEqual({ deletedCount: 2 });
    expect(calls).toEqual(["artifacts:4", "artifacts:9", "records:3"]);
  });
});
