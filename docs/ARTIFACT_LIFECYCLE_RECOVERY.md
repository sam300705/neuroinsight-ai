# Artifact Lifecycle Recovery

NeuroInsight AI uses a durable intent model for account-owned derived artifacts such as Mode A reports and Grad-CAM outputs. The design separates short database transactions from slower storage-provider network operations.

## State model

Each artifact operation has an immutable intent ID and storage key.

- `pending`: operation was recorded before storage upload/finalization completed.
- `committed`: the database active pointer was atomically finalized.
- `cancelled`: the attempt must not become active; any real abandoned provider object is eligible for cleanup.
- `cleanupComplete = 1`: all cleanup work represented by the intent is finished.

Legacy `pending:` strings are metadata placeholders from the older implementation, not physical provider keys. Recovery recognizes them and does not submit them to provider deletion.

## Registration invariant

1. Validate the derived artifact payload and create a unique owner-scoped attempt key.
2. Persist a `pending` intent before uploading bytes.
3. Upload outside a DB transaction.
4. In a short transaction, lock in consistent order: scan → intent → active artifact row.
5. Finalize only if the intent is still `pending`.
6. Atomically update the active artifact pointer and mark the intent `committed`.
7. Delete a displaced real provider key outside the transaction.
8. Mark cleanup complete; if deletion/acknowledgment fails, durable recovery retries later.

All real storage cleanup keys must remain under `neuroinsight/<userId>/...`.

## Delete invariant

For single and bulk history deletion, the application re-reads and locks the exact owned scan/artifact pointers inside the transaction. It creates detached durable cleanup intents for existing real provider objects, cancels unfinished upload intents, and deletes the owned metadata in the same transaction.

After commit, known provider objects are deleted outside the transaction. A provider failure does not recreate deleted history metadata; instead, the durable cleanup intent remains incomplete for reconciliation.

## Automatic reconciliation

`server/neuroinsight/recoveryWorker.ts` starts only when the database and current managed-storage provider configuration are available.

- batch size: maximum 50
- sweep interval: 60 seconds
- stale upload/cancelled settle grace: 5 minutes
- sweeps never overlap within a process
- successful cleanup marks the intent complete
- failures increment retry bookkeeping
- failed committed cleanup uses the intent timestamp as a bounded backoff clock

The five-minute grace is intentionally longer than the current storage upload timeout so an upload that timed out locally but later finishes at the provider is not erased too early and then allowed to reappear after the delete request.

An admin-only `maintenance.reconcileArtifactIntents` tRPC mutation can trigger the same bounded reconciliation batch when operational intervention is appropriate.

## Ambiguous outcomes

A stale `pending` intent is resolved under row locks:

- if its storage key is the active artifact pointer, recovery transitions it to `committed` and cleans any displaced real key;
- otherwise it transitions to `cancelled` and cleans the abandoned real attempt key after the settle boundary.

A concurrent finalization observed after locks are acquired is respected; recovery does not overwrite that state.

## Schema requirements

The complete artifact-lifecycle schema requires migrations `0004` → `0005` → `0006`.

Only intent bookkeeping is allowed to outlive its parent. Active scan rows remain tied to users and active artifact rows remain tied to scans. See `docs/MIGRATIONS.md`.

## What this proves — and what it does not

This architecture makes unresolved storage work **durably discoverable and retryable** after ordinary application crashes/acknowledgment failures. It does not by itself prove that a managed storage provider actually erased an object. A real synthetic provider save/download/delete/reconciliation exercise is still required before making physical-erasure guarantees.
