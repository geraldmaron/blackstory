# RPO and RTO targets (BB-020)

Targets assume Firestore (ADR-011) with managed export + PITR and GCS versioning for blobs.

## Recovery objectives

| Scenario | RPO (max data loss) | RTO (time to restore service) | Primary mechanism |
|----------|---------------------|-------------------------------|-------------------|
| Accidental doc delete (last 7 days) | **≤ 1 hour** (PITR granularity) | **≤ 4 hours** | Firestore PITR restore to new DB or selective import |
| Regional Firestore outage | **≤ 24 hours** | **≤ 8 hours** | Latest weekly full export + on-release exports |
| Corrupt release activation | **0** (manifest mismatch blocks bad pointer) | **≤ 2 hours** | Roll back `publicMeta` to prior `active` release (BB-019) |
| Evidence blob overwrite | **0** (versioned object) | **≤ 4 hours** | GCS object generation restore |
| Full project disaster | **≤ 24 hours** | **≤ 24 hours** | Cross-region copy of backup bucket (human step) |

## PITR window

- **Minimum:** 7 days (Firestore default when enabled).
- **Recommended after beta:** 30 days if operational budget allows (tightens RPO for logical errors
  discovered late).
- PITR is **not** a substitute for cross-region export copies.

## Verification cadence

| Check | Frequency | Owner |
|-------|-----------|-------|
| Export metadata sidecar (counts + hashes) | Every daily export | `backup@` job |
| Manifest integrity on active release | Every on-release export | `backup@` + publication worker |
| Full staging restore drill | **Quarterly** | Security + platform (runbook) |
| IAM deny-delete audit | Quarterly | Security |

## Deferred Cloud SQL

If Postgres is reintroduced per ADR-011 migration triggers, add separate RPO/RTO rows for Cloud SQL
automated backups and PITR. Current phase: **N/A — deferred**.
