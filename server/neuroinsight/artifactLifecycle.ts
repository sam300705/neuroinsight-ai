export type OwnedArtifact = { id: number; storageKey: string; artifactType: string };

type DownloadDependencies = {
  findOwnedArtifact: (userId: number, artifactId: number) => Promise<OwnedArtifact | undefined>;
  createSignedUrl: (storageKey: string) => Promise<string>;
};

type DeleteOneDependencies = {
  findOwnedScan: (userId: number, scanId: string) => Promise<{ id: number } | undefined>;
  deleteArtifactMetadata: (scanRecordId: number) => Promise<void>;
  deleteScanMetadata: (scanRecordId: number) => Promise<void>;
};

type DeleteAllDependencies = {
  listOwnedScanIds: (userId: number) => Promise<number[]>;
  deleteArtifactMetadata: (scanRecordId: number) => Promise<void>;
  deleteAllScanMetadata: (userId: number) => Promise<void>;
};

/**
 * Issues a new signed URL only after the caller's ownership-scoped lookup succeeds.
 * The signed URL is intentionally generated on demand and is never persisted in the database.
 */
export async function issueOwnedArtifactDownload(
  userId: number,
  artifactId: number,
  dependencies: DownloadDependencies,
) {
  const artifact = await dependencies.findOwnedArtifact(userId, artifactId);
  if (!artifact) throw new Error("Artifact was not found for this user.");
  return { ...artifact, storageUrl: await dependencies.createSignedUrl(artifact.storageKey) };
}

/**
 * Removes the owning user's artifact and scan metadata. The platform storage layer deliberately
 * exposes no object-delete API; without a key or database reference, the derived object is no
 * longer reachable through the application. Raw MRI uploads are never stored by this workflow.
 */
export async function deleteOwnedScan(
  userId: number,
  scanId: string,
  dependencies: DeleteOneDependencies,
) {
  const record = await dependencies.findOwnedScan(userId, scanId);
  if (!record) return { deleted: false };
  await dependencies.deleteArtifactMetadata(record.id);
  await dependencies.deleteScanMetadata(record.id);
  return { deleted: true };
}

/** Removes metadata only for records owned by the authenticated user. */
export async function deleteAllOwnedScans(userId: number, dependencies: DeleteAllDependencies) {
  const recordIds = await dependencies.listOwnedScanIds(userId);
  for (const recordId of recordIds) await dependencies.deleteArtifactMetadata(recordId);
  await dependencies.deleteAllScanMetadata(userId);
  return { deletedCount: recordIds.length };
}
