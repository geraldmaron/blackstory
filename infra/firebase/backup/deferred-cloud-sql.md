# Deferred: Cloud SQL backup and PITR

The execution bead PDF references **Cloud SQL PITR**. Black Book's accepted architecture
(**ADR-011**, **D-014**) uses **Firestore** as the system of record. Cloud SQL artifacts under
`infra/database/` are **parked**, not production.

## What is deferred

| PDF / BB-020 concept | Firestore-era replacement |
|----------------------|---------------------------|
| Cloud SQL automated backups | Firestore managed export to `black-book-efaaf-firestore-backups` |
| Cloud SQL PITR | Firestore PITR (when DB enabled) + daily/weekly exports |
| `role_backup_readonly` on Postgres | `backup@` SA: export + read backup bucket only |
| Cross-region read replica | Cross-region GCS bucket replication (human provision) |

## If Postgres returns

Revisit when ADR-011 migration triggers fire (complex spatial joins, full-text in-DB, etc.):

1. Add Cloud SQL backup window and PITR retention to [`rpo-rto.md`](./rpo-rto.md).
2. Extend [`iam-backup-protection.md`](./iam-backup-protection.md) with `cloudsql.backupRuns.get`.
3. Update `backup@` roles in [`infra/gcp/isolation-matrix.json`](../../gcp/isolation-matrix.json).

Until then, **do not provision** a paid Cloud SQL instance for backup compliance.
