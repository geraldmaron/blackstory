# Firestore backup, PITR, and restore (BB-020)

Backup design for **Firestore** (ADR-011 / D-014 system of record) and **GCS** object
versioning. Cloud SQL PITR from the execution PDF is **deferred** — see
[`deferred-cloud-sql.md`](./deferred-cloud-sql.md).

## Artifacts

| File | Purpose |
|------|---------|
| [`export-schedule.md`](./export-schedule.md) | Automated Firestore export schedule by collection tier |
| [`retention-matrix.json`](./retention-matrix.json) | Machine-readable retention per tier |
| [`retention-matrix.md`](./retention-matrix.md) | Human-readable retention matrix |
| [`rpo-rto.md`](./rpo-rto.md) | Recovery point/time objectives |
| [`iam-backup-protection.md`](./iam-backup-protection.md) | IAM matrix; runtime SAs cannot delete backups |
| [`storage-versioning.md`](./storage-versioning.md) | GCS versioning guidance for evidence and public releases |
| [`gcloud/`](./gcloud/) | Non-interactive `gcloud` stubs (dry-run / print-only) |
| [`terraform/`](./terraform/) | Terraform stubs for backup bucket + IAM (no live apply) |

## Scripts and runbook

- Verification helpers and dry-run restore checks:
  [`../../../scripts/backup-restore/`](../../../scripts/backup-restore/)
- Operator procedure:
  [`../../../docs/runbooks/backup-restore.md`](../../../docs/runbooks/backup-restore.md)

## Human cloud steps (not automated in repo)

1. Enable Firestore Native mode and choose database location (prerequisite for export/PITR).
2. Create `black-book-efaaf-firestore-backups` bucket from Terraform stub after review.
3. Bind `backup@` SA per IAM matrix; apply deny-delete conditions.
4. Enable Firestore PITR (7-day minimum; extend per `rpo-rto.md`).
5. Deploy Cloud Scheduler jobs from `gcloud/export-schedule.stub.sh` (human apply).
6. Run quarterly restore drill per runbook using staging project credentials only.
