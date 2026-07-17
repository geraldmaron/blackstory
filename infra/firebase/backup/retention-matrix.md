# Retention matrix (BB-020)

Machine-readable source: [`retention-matrix.json`](./retention-matrix.json).

## Summary

| Tier | Firestore collections | Export cadence | Retention | GCS blobs |
|------|----------------------|----------------|-----------|-----------|
| **canonical** | Entities, claims, policy, merges, kill switches | Daily + weekly full | 7 years (2555 days) | — |
| **evidence** | Sources, captures, evidence records, lineage | Daily + weekly full | 7 years | `private-evidence` versioned |
| **audit** | `auditEvents`, outbox, idempotency | Daily + weekly full | 7+ years, immutable | — |
| **publication** | `publicationReleases`, `publicMeta` | Daily + on-release | Indefinite (active/superseded); drafts 90d | — |
| **public** | `publicReleases`, `publicSearchIndex` | Daily + on-release | Indefinite per release | `public/releases/**` versioned |
| **quarantine** | `submissionInbox` | Optional weekly | 30 days | `quarantine` short TTL |

## Separate retention rationale

- **Canonical** and **evidence** share long retention but export on staggered schedules so a
  corrupted single-tier job does not hide data loss in the other tier.
- **Audit** retention is never shortened without legal review; exports are write-once in the backup
  bucket (object versioning enabled on the backup bucket).
- **Publication** manifests are indefinite because BB-019 release history reconstruction depends on
  signed envelopes and `publicMeta/activeRelease` pointers.
- **Public** release projections and JSON snapshots are immutable; retention is per-release, not
  global TTL.
- **Quarantine** is excluded from disaster-recovery SLAs.

## Backup bucket lifecycle

Prefix layout under `gs://black-book-efaaf-firestore-backups/`:

```text
exports/daily/{yyyy}/{mm}/{dd}/{tier}/
exports/weekly/{yyyy}/W{ww}/full/
exports/releases/{releaseId}/{timestamp}/
metadata/{exportId}.json
```

Daily tier folders age out after 90 days once the weekly full and metadata sidecar verify. Weekly
fulls transition to Nearline (30d) then Coldline (365d). On-release exports are not auto-deleted.

## Storage versioning (blobs)

See [`storage-versioning.md`](./storage-versioning.md) for bucket-level versioning on
`private-evidence`, `public-media` release snapshots, and the dedicated backup bucket.
