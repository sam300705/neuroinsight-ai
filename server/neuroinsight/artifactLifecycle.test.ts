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
      deleteStoredArtifact: async key => { calls.push(`storage:${key}`); },
      deleteArtifactMetadata: async id => { calls.push(`artifacts:${id}`); },
      deleteScanMetadata: async id => { calls.push(`scan:${id}`); },
    });
    expect(result).toEqual({ deleted: false });
    expect(calls).toEqual([]);
  });

  it("removes owned physical artifacts before metadata", async () => {
    const calls: string[] = [];
    const result = await deleteOwnedScan(1, "scan-1", {
      findOwnedScan: async (userId, scanId) => userId === 1 && scanId === "scan-1" ? { id: 14, artifacts: [{ id: 8, artifactType: "report", storageKey: "neuroinsight/1/scan-1/report.pdf" }] } : undefined,
      deleteStoredArtifact: async key => { calls.push(`storage:${key}`); },
      deleteArtifactMetadata: async id => { calls.push(`artifacts:${id}`); },
      deleteScanMetadata: async id => { calls.push(`scan:${id}`); },
    });
    expect(result).toEqual({ deleted: true });
    expect(calls).toEqual(["storage:neuroinsight/1/scan-1/report.pdf", "artifacts:14", "scan:14"]);
  });

  it("keeps metadata when physical deletion fails so the operation can be retried", async () => {
    const calls: string[] = [];
    await expect(deleteOwnedScan(1, "scan-1", {
      findOwnedScan: async () => ({ id: 14, artifacts: [{ id: 8, artifactType: "report", storageKey: "neuroinsight/1/scan-1/report.pdf" }] }),
      deleteStoredArtifact: async key => { calls.push(`storage:${key}`); throw new Error("storage unavailable"); },
      deleteArtifactMetadata: async id => { calls.push(`artifacts:${id}`); },
      deleteScanMetadata: async id => { calls.push(`scan:${id}`); },
    })).rejects.toThrow("storage unavailable");
    expect(calls).toEqual(["storage:neuroinsight/1/scan-1/report.pdf"]);
  });

  it("rejects a stored key outside the authenticated user's namespace", async () => {
    let storageCalls = 0;
    await expect(deleteOwnedScan(1, "scan-1", {
      findOwnedScan: async () => ({ id: 14, artifacts: [{ id: 8, artifactType: "report", storageKey: "neuroinsight/2/scan-1/report.pdf" }] }),
      deleteStoredArtifact: async () => { storageCalls += 1; },
      deleteArtifactMetadata: async () => undefined,
      deleteScanMetadata: async () => undefined,
    })).rejects.toThrow("outside the authenticated user scope");
    expect(storageCalls).toBe(0);
  });

  it("purges only the current user's listed metadata records", async () => {
    const calls: string[] = [];
    const result = await deleteAllOwnedScans(3, {
      listOwnedScans: async userId => userId === 3 ? [
        { id: 4, artifacts: [{ id: 11, artifactType: "grad_cam", storageKey: "neuroinsight/3/scan-a/grad_cam.png" }] },
        { id: 9, artifacts: [] },
      ] : [],
      deleteStoredArtifact: async key => { calls.push(`storage:${key}`); },
      deleteArtifactMetadata: async id => { calls.push(`artifacts:${id}`); },
      deleteScanMetadata: async id => { calls.push(`scan:${id}`); },
    });
    expect(result).toEqual({ deletedCount: 2 });
    expect(calls).toEqual(["storage:neuroinsight/3/scan-a/grad_cam.png", "artifacts:4", "scan:4", "artifacts:9", "scan:9"]);
  });

  it("does not sign an incomplete legacy pending artifact", async () => {
    await expect(issueOwnedArtifactDownload(1, 7, {
      findOwnedArtifact: async () => ({ id: 7, artifactType: "report", storageKey: "pending:legacy" }),
      createSignedUrl: async () => "https://example.invalid/should-not-be-called",
    })).rejects.toThrow("upload is incomplete");
  });
});
