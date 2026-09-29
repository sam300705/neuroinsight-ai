# Database Migrations

## 0002 — ownership-scoped scans and idempotent artifacts

`drizzle/0002_steady_rhodey.sql` replaces the globally unique `scan_records.scanId` constraint with a compound unique constraint on `(userId, scanId)`. It also enforces one artifact of each type per scan through `(scanRecordId, artifactType)`, and adds cascading foreign keys from scan records to users and from artifacts to scan records.

Before applying the migration, the managed database was checked for duplicate compound keys and orphaned user/artifact references. No conflicts were present. The migration changes indexes and constraints only; it does not rewrite, delete, or synthesize records.

| Invariant | Effect |
|---|---|
| `UNIQUE(userId, scanId)` | A user can idempotently update only that user's own scan ID. The same client ID cannot cause an update to another account's record. |
| `UNIQUE(scanRecordId, artifactType)` | Repeated or concurrent artifact registration cannot create duplicate report/Grad-CAM rows. |
| `scan_records.userId → users.id` | A deleted account cascades only to its own metadata rows. |
| `scan_artifacts.scanRecordId → scan_records.id` | Deleted scan metadata cascades to artifact metadata references. Physical object deletion remains a separate provider capability. |

### Rollback procedure

Rollback should be performed only after confirming that no two users now share a `scanId`, because the original global uniqueness constraint cannot represent that valid new state. If rollback is necessary, first remove the two foreign keys and compound artifact constraint, then replace `scan_records_user_scan_unique` with `scan_records_scanId_unique`. The exact SQL is deliberately documented rather than automated because a blind rollback could reject legitimate ownership-scoped history created after this migration.

```sql
ALTER TABLE scan_artifacts DROP FOREIGN KEY scan_artifacts_scanRecordId_scan_records_id_fk;
ALTER TABLE scan_records DROP FOREIGN KEY scan_records_userId_users_id_fk;
ALTER TABLE scan_artifacts DROP INDEX scan_artifacts_record_type_unique;
ALTER TABLE scan_records DROP INDEX scan_records_user_scan_unique;
ALTER TABLE scan_records ADD CONSTRAINT scan_records_scanId_unique UNIQUE(scanId);
```

This migration does **not** establish provider-side physical deletion of derived objects. See `MANUAL_GATES.md` and `docs/PRIVACY_DATA_MAP.md` for that separate limitation.

## 0003 — bounded history cursor index

`drizzle/0003_quick_catseye.sql` adds `scan_records_user_id_idx(userId, id)`. It supports newest-first, ownership-scoped cursor pagination without an unbounded account-history query. It does not alter row content or access rules. Rollback is `DROP INDEX scan_records_user_id_idx ON scan_records;` if a future query plan no longer uses the index.
