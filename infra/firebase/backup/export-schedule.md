# Firestore export schedule (BB-020)

Designed for project `black-book-efaaf` with Firestore as system of record. Exports land in
`gs://black-book-efaaf-firestore-backups/` (dedicated fifth bucket; see
[`retention-matrix.md`](./retention-matrix.md)).

**Do not apply from CI.** Use [`gcloud/export-schedule.stub.sh`](./gcloud/export-schedule.stub.sh)
to print commands after human review.

## Collection tiers

Tiers align with [`FIRESTORE_MODEL.md`](../FIRESTORE_MODEL.md) boundaries and BB-019 release
artifacts.

| Tier | Root collections / paths | Export trigger | Notes |
|------|--------------------------|----------------|-------|
| **canonical** | `policy`, `policyVersions`, `researchCases`, `canonicalEntities` (+ `locations` subcollections), `canonicalClaims`, `claimEvidenceLinks`, `entityRelationships`, `entityMerges`, `killSwitches` | Daily 02:00 UTC | Full-database export includes subcollections; path filter optional for incremental experiments |
| **evidence** | `sourceOrganizations`, `sourceDomains`, `evidenceSources`, `sourceItems`, `sourceCaptures`, `retrievalEvents`, `evidenceRecords`, `evidenceLineage` | Daily 02:30 UTC | Metadata only in Firestore; blobs verified separately via Storage inventory |
| **audit** | `auditEvents`, `outboxMessages`, `idempotencyKeys`, `outboxConsumerReceipts` | Daily 03:00 UTC | Append-only; export is authoritative for compliance replay |
| **publication** | `publicationReleases`, `publicMeta` | On release activation + daily 03:30 UTC | Signed manifests; tie to BB-019 verification |
| **public** | `publicReleases` (+ `entities` subcollections), `publicSearchIndex` | On release activation + daily 04:00 UTC | Immutable projections; cross-check manifest hashes post-export |

`submissionInbox` is **excluded** from long-retention canonical backups (quarantine TTL). Include
only in a separate 30-day quarantine export if operational recovery is required.

## Scheduler design

| Job ID | Cron (UTC) | Scope | Output prefix |
|--------|------------|-------|---------------|
| `firestore-export-canonical-daily` | `0 2 * * *` | All collections (tier tag `canonical` in metadata) | `exports/daily/{yyyy}/{mm}/{dd}/canonical/` |
| `firestore-export-evidence-daily` | `30 2 * * *` | Same export operation; metadata tag `evidence` | `exports/daily/{yyyy}/{mm}/{dd}/evidence/` |
| `firestore-export-audit-daily` | `0 3 * * *` | Metadata tag `audit` | `exports/daily/{yyyy}/{mm}/{dd}/audit/` |
| `firestore-export-publication-daily` | `30 3 * * *` | Metadata tag `publication` | `exports/daily/{yyyy}/{mm}/{dd}/publication/` |
| `firestore-export-public-daily` | `0 4 * * *` | Metadata tag `public` | `exports/daily/{yyyy}/{mm}/{dd}/public/` |
| `firestore-export-weekly-full` | `0 5 * * 0` | Full database | `exports/weekly/{yyyy}/W{ww}/full/` |
| `firestore-export-on-release` | Event-driven (Pub/Sub from publication worker) | `publication` + `public` tiers | `exports/releases/{releaseId}/{timestamp}/` |

Firestore managed export is **whole-database** per invocation. Tier jobs share one export
operation but write to distinct prefix folders and attach tier labels in export metadata JSON
(sidecar written by the post-export hook). Weekly full is the cross-tier integrity baseline.

## Post-export hook (design)

After each export completes, a Cloud Run job (identity: `backup@`) writes:

```json
{
  "schemaVersion": 1,
  "exportUri": "gs://black-book-efaaf-firestore-backups/exports/...",
  "completedAt": "ISO-8601",
  "tier": "canonical",
  "documentCounts": { "canonicalEntities": 1204, "canonicalClaims": 8832 },
  "collectionHashes": { "canonicalEntities": "sha256-hex", "canonicalClaims": "sha256-hex" },
  "releaseManifestChecks": []
}
```

Counts and hashes are produced by
[`scripts/backup-restore/verify-restore.mjs`](../../../scripts/backup-restore/verify-restore.mjs)
against the export metadata (or a restored staging copy). On-release exports add
`releaseManifestChecks` from BB-019 manifest verification.

## Firestore PITR

When the production database is enabled:

- Turn on **Point-in-Time Recovery** (PITR) on the default Firestore database.
- Default window: **7 days** (extend to 30 days if RPO target requires; see [`rpo-rto.md`](./rpo-rto.md)).
- PITR complements exports: use PITR for recent accidental deletes; use GCS exports for
  cross-region disaster recovery and quarterly restore drills.

PITR does **not** replace signed release manifest verification or Storage object versioning.

## Staging restore (no production secrets)

Quarterly drills restore into an isolated staging Firestore database (or `demo-black-book` emulator
fixtures for CI) using:

1. Export URI from weekly full (not production API keys).
2. Service account `backup@` in staging only — never copy production Secret Manager material.
3. [`scripts/backup-restore/staging-restore.stub.sh`](../../scripts/backup-restore/staging-restore.stub.sh)
   prints `gcloud firestore import` with `--dry-run` by default.

See [`docs/runbooks/backup-restore.md`](../../../docs/runbooks/backup-restore.md).
