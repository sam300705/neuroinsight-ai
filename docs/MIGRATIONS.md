# Database Migrations

Migrations are append-only and must be applied in repository order. Do not selectively apply a later artifact-lifecycle migration while omitting its predecessor/corrective migration.

## 0002 — ownership-scoped scans and idempotent artifacts

`0002_steady_rhodey.sql` changes scan identity to `UNIQUE(userId, scanId)`, enforces one artifact per `(scanRecordId, artifactType)`, and originally establishes user/scan/artifact foreign-key relationships.

## 0003 — bounded history cursor index

`0003_quick_catseye.sql` adds `scan_records_user_id_idx(userId, id)` for ownership-scoped newest-first cursor pagination.

## 0004 — durable artifact intents

`0004_equal_captain_flint.sql` creates `scan_artifact_intents` with operation ID, scan/user ownership context, attempted and displaced storage keys, `pending`/`committed`/`cancelled` state, cleanup status, retry count, timestamps, and indexes.

The original `0004` foreign keys cascade with the parent. That was insufficient for cleanup records that must survive a scan deletion long enough to erase an already-created provider object.

## 0005 — detachable cleanup bookkeeping

`0005_conscious_jocasta.sql` makes `scan_artifact_intents.scanRecordId` nullable with `ON DELETE SET NULL` and detaches intent `userId` from the users table so cleanup records can survive parent deletion.

That migration also temporarily detached the active scan→user relationship and made active artifact→scan references nullable/set-null. The final schema does **not** leave those active metadata relationships detached.

## 0006 — restore active metadata referential guards

`0006_restore_referential_guards.sql` is the mandatory correction after `0005`:

- `scan_records.userId → users.id` is restored with `ON DELETE RESTRICT`.
- `scan_artifacts.scanRecordId` becomes `NOT NULL` and references `scan_records.id` with `ON DELETE RESTRICT`.
- `scan_artifact_intents.scanRecordId` remains nullable/set-null intentionally.
- `scan_artifact_intents.userId` remains intentionally detached so cleanup can be completed after parent deletion.

### Preflight before applying 0006

Run these read-only checks first. Every query must return `0` before applying `0006`:

```sql
SELECT COUNT(*) AS null_artifact_parents
FROM scan_artifacts
WHERE scanRecordId IS NULL;

SELECT COUNT(*) AS missing_scan_parents
FROM scan_artifacts a
LEFT JOIN scan_records s ON s.id = a.scanRecordId
WHERE s.id IS NULL;

SELECT COUNT(*) AS missing_user_parents
FROM scan_records s
LEFT JOIN users u ON u.id = s.userId
WHERE u.id IS NULL;
```

If any count is non-zero, stop. Investigate and reconcile the orphaned metadata before altering constraints. Do not blindly delete or fabricate rows.

### Deployment order for an environment currently at 0003 or earlier

1. Take the environment's normal database backup/snapshot.
2. Run the three preflight queries above.
3. Apply `0004_equal_captain_flint.sql`.
4. Apply `0005_conscious_jocasta.sql`.
5. Apply `0006_restore_referential_guards.sql`.
6. Re-run the orphan preflight queries.
7. Start the application and verify the artifact reconciliation worker can access the database and configured storage provider.
8. In non-production, perform a synthetic save → replace → download → delete → reconciliation exercise before relying on physical-erasure claims.

### Environment already on 0005

Do not roll back `0005`. Run the preflight checks, then apply `0006` and verify the resulting foreign keys/column nullability.

## Runtime invariant

Application deletion records durable cleanup work before owned metadata is removed. Physical provider deletion occurs outside the database transaction; failures remain retryable in `scan_artifact_intents`.

Database migration success does not prove storage-provider erasure. That remains a managed-integration verification gate in `MANUAL_GATES.md`.
