export type OwnedArtifact = { id: number; storageKey: string; artifactType: string };
export type OwnedScan = { id: number; artifacts: OwnedArtifact[] };

type DownloadDependencies = {
  findOwnedArtifact: (userId: number, artifactId: number) => Promise<OwnedArtifact | undefined>;
  createSignedUrl: (storageKey: string) => Promise<string>;
};

type DeleteOneDependencies = {
  findOwnedScan: (userId: number, scanId: string) => Promise<OwnedScan | undefined>;
  deleteStoredArtifact: (storageKey: string) => Promise<void>;
  deleteArtifactMetadata: (scanRecordId: number) => Promise<void>;
  deleteScanMetadata: (scanRecordId: number) => Promise<void>;
};

type DeleteAllDependencies = {
  listOwnedScans: (userId: number) => Promise<OwnedScan[]>;
  deleteStoredArtifact: (storageKey: string) => Promise<void>;
  deleteArtifactMetadata: (scanRecordId: number) => Promise<void>;
  deleteScanMetadata: (scanRecordId: number) => Promise<void>;
};

function assertOwnedStorageKey(userId: number, storageKey: string) {
  if (!storageKey.startsWith(`neuroinsight/${userId}/`)) {
    throw new Error("Artifact storage key is outside the authenticated user scope.");
  }
}

async function deletePhysicalArtifacts(userId: number, artifacts: OwnedArtifact[], deleteStoredArtifact: (storageKey: string) => Promise<void>) {
  for (const artifact of artifacts) {
    if (artifact.storageKey.startsWith("pending:")) continue;
    assertOwnedStorageKey(userId, artifact.storageKey);
    await deleteStoredArtifact(artifact.storageKey);
  }
}

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
  if (artifact.storageKey.startsWith("pending:")) throw new Error("Artifact upload is incomplete. Please retry saving the result.");
  return { ...artifact, storageUrl: await dependencies.createSignedUrl(artifact.storageKey) };
}

/**
 * Physically removes the owning user's derived objects before deleting their metadata.
 * A storage failure leaves metadata intact so deletion can be retried safely.
 */
export async function deleteOwnedScan(
  userId: number,
  scanId: string,
  dependencies: DeleteOneDependencies,
) {
  const record = await dependencies.findOwnedScan(userId, scanId);
  if (!record) return { deleted: false };
  await deletePhysicalArtifacts(userId, record.artifacts, dependencies.deleteStoredArtifact);
  await dependencies.deleteArtifactMetadata(record.id);
  await dependencies.deleteScanMetadata(record.id);
  return { deleted: true };
}

/** Physically removes each owned scan's artifacts before its metadata. */
export async function deleteAllOwnedScans(userId: number, dependencies: DeleteAllDependencies) {
  const records = await dependencies.listOwnedScans(userId);
  for (const record of records) {
    await deletePhysicalArtifacts(userId, record.artifacts, dependencies.deleteStoredArtifact);
    await dependencies.deleteArtifactMetadata(record.id);
    await dependencies.deleteScanMetadata(record.id);
  }
  return { deletedCount: records.length };
}
