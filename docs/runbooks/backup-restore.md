# Runbook: Firestore backup and restore

**Scope:** Firestore (ADR-011) managed export, PITR, GCS versioning,  release verification.
**Not in scope:** Cloud SQL PITR (deferred — see [`infra/firebase/backup/deferred-cloud-sql.md`](../../infra/firebase/backup/deferred-cloud-sql.md)).

## Prerequisites

- Production Firestore database enabled with PITR (human step).
- Bucket `black-book-efaaf-firestore-backups` provisioned per Terraform stub.
- `backup@black-book-efaaf.iam.gserviceaccount.com` bound per IAM matrix.
- Staging project or isolated database for drills (**no production Secret Manager exports**).

## Daily operations (automated)

1. Cloud Scheduler triggers Firestore export (see [`export-schedule.md`](../../infra/firebase/backup/export-schedule.md)).
2. `backup@` post-export job writes metadata sidecar to `metadata/{exportId}.json`.
3. CI or ops cron runs:

```bash
node scripts/backup-restore/verify-restore.mjs \
  --metadata gs://... # copy sidecar locally first, or mount in job \
  --baseline-counts path/to/last-known-counts.json \
  --baseline-hashes path/to/last-known-hashes.json
```

On failure: page platform + security; do not delete prior weekly full.

## Quarterly restore test

**Goal:** Prove RTO/RPO targets in [`rpo-rto.md`](../../infra/firebase/backup/rpo-rto.md) without exposing production secrets.

### 1. Select export

- Use latest **weekly full** prefix: `exports/weekly/{year}/Week-{ww}/full/`.
- Record export URI and `completedAt` in drill ticket.

### 2. Staging import (no prod credentials)

```bash
# Print-only (default)
bash scripts/backup-restore/staging-restore.stub.sh \
  gs://black-book-efaaf-firestore-backups/exports/weekly/2026/Week-29/full/ \
  black-book-staging-restore

# Human executes printed gcloud import with staging-only SA
```

**Never:** copy production App Hosting secrets, publication signing keys, or `web-runtime` Secret Manager refs into staging.

### 3. Verification checklist

| Step | Command / action | Pass criteria |
|------|----------------|---------------|
| Document counts | `verify-restore.mjs --baseline-counts` | All collections match ±0 |
| Collection hashes | `verify-restore.mjs --baseline-hashes` | All sha256 digests match |
| Active release | `--active-pointer` + `--release` | Pointer matches signed manifest |
| Manifest envelope | embedded in metadata `releaseManifestChecks` | `verifyManifestEnvelope` ok |
| Public snapshot spot-check | Compare one `snapshotHash` to GCS object bytes | sha256 match |
| IAM deny-delete | `verify-iam-matrix.mjs` + manual 403 test | Runtime SAs cannot delete backups |

```bash
node scripts/backup-restore/verify-restore.mjs \
  --metadata ./drill/metadata.json \
  --baseline-counts ./drill/baseline-counts.json \
  --baseline-hashes ./drill/baseline-hashes.json \
  --active-pointer ./drill/active-pointer.json \
  --release ./drill/release.json
```

### 4. Tear down

- Delete staging import database or project slice.
- Archive drill report (ticket + command log + verification JSON).

## Point-in-time recovery (operational)

For accidental deletes within PITR window:

1. Identify timestamp (UTC) from audit trail.
2. Human runs Firestore PITR restore to **new** database ID (not in-place overwrite).
3. Run `verify-restore.mjs` against export closest to timestamp.
4. Merge recovered docs via controlled migration job (out of  scope).

## Release-specific restore

If a bad activation slipped past checks (should be blocked by ):

1. Roll back `publicMeta/activeRelease` to last good `active` release (publication worker).
2. Restore `publication` + `public` tier on-release export for that `releaseId`.
3. Verify manifest signature and pointer alignment before re-activating.

## Escalation

| Severity | Condition | Action |
|----------|-----------|--------|
| SEV2 | Daily export missing | Trigger manual export; investigate Scheduler |
| SEV1 | Weekly full corrupt / hash mismatch | Halt releases; restore from prior weekly + PITR |
| SEV1 | Backup bucket delete attempted by runtime SA | Security incident; rotate credentials |

## References

- [`infra/firebase/backup/README.md`](../../infra/firebase/backup/README.md)
- [`retention-matrix.md`](../../infra/firebase/backup/retention-matrix.md)
- [`iam-backup-protection.md`](../../infra/firebase/backup/iam-backup-protection.md)
- [`scripts/backup-restore/README.md`](../../scripts/backup-restore/README.md)
