# Artifact Lifecycle Recovery

This document explains the recovery and lifecycle mechanisms for derived artifacts (e.g., reports, grad-cams) in NeuroInsight AI, specifically addressing ambiguous database commits and concurrent mutations.

## State Transitions and Invariants

1. **Pending**: An intent to register a new artifact is created in the `scan_artifact_intents` table.
   - *Invariant*: The physical upload to storage occurs *after* this intent is durably saved to the DB. If persistence fails, no physical object is uploaded.
2. **Committed**: The upload succeeds, and a database transaction assigns the new storage key to the `scan_artifacts` table. The intent state is updated to `committed` inside the same transaction.
   - *Invariant*: The active pointer always points to a successfully uploaded artifact.
3. **Cancelled**: If the upload fails, or if a concurrent scan deletion cancels pending intents, the intent transitions to `cancelled`.
   - *Invariant*: Cancelled intents leave the old active pointer intact. Unreferenced attempt storage keys are subsequently garbage collected.

## Transaction and Locking Boundaries

Artifact finalization requires short, precise database transactions. We use `FOR UPDATE` read locks to prevent concurrent mutations (e.g., scan deletion or multiple artifact registrations racing):
- **Finalization**: We verify that the scan record still exists and that the intent has not been cancelled by a deletion process before updating the active artifact pointer.
- **Deletion**: We cancel all `pending` intents for a scan within the deletion transaction to ensure late-completing uploads are never finalized into a deleted scan.

## Reconciliation and Cleanup

The `reconcileIntents` routine identifies unfinished operations (pending or uncleaned intents):
- **Ambiguous Commits**: A `pending` intent is evaluated to determine if its storage key became the active pointer (the commit succeeded but acknowledgment was lost).
  - If active: The intent is transitioned to `committed` and the displaced old object is deleted from storage.
  - If not active: The intent is transitioned to `cancelled` to prevent future finalization, and the abandoned attempt object is deleted.
- **Out of Transaction**: Storage deletion commands (`storageDelete`) always execute outside of database transactions. Database tables are never locked while waiting for storage networks.

## Retry Behavior and Rollback Limitations

- **Retries**: If a storage provider deletion fails, the cleanup is left incomplete. The intent's `retryCount` is incremented during subsequent reconciliation sweeps until successful.
- **Crashes**: The durable intent table ensures that no unreferenced storage object leaks during process crash or DB outage. All unresolved uploads are safely discoverable on restart.
- **Existing-Row Compatibility**: Existing artifacts that lack intents simply remain active. Replacements of those existing artifacts will generate `displacedStorageKey` metadata and be safely cleaned up.

## Deployment Prerequisites

Deploy the updated schema (`0004_equal_captain_flint.sql`) before rolling out backend updates. No backfill is strictly required; existing rows remain operational.
