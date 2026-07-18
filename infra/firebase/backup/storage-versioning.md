# GCS storage versioning (BB-020)

Versioning protects **blob** recovery; Firestore exports protect **metadata**. Both are required for
ADR-011.

## Buckets

| Bucket | Versioning | Rationale |
|--------|------------|-----------|
| `black-book-efaaf-private-evidence` | **Enabled** (existing BB-005 design) | Accidental overwrite of capture snapshots or media |
| `black-book-efaaf-public-media` | **Enabled** for `public/releases/**` prefix | Immutable BB-019 JSON snapshots; never edit in place |
| `black-book-efaaf-firestore-backups` | **Enabled** | Export metadata sidecars and manifest verification inputs |
| `black-book-efaaf-exports` | Disabled (short TTL) | Ephemeral user exports |
| `black-book-efaaf-quarantine` | Disabled | Short lifecycle; not DR-critical |

## Public release snapshots

Path layout (BB-019 / ADR-004):

```text
gs://black-book-efaaf-public-media/public/releases/{releaseId}/entities/{entityId}.json
gs://black-book-efaaf-public-media/public/releases/{releaseId}/entities.json
gs://black-book-efaaf-public-media/public/releases/{releaseId}/search-index.json
```

- Per-entity JSON: optional fine-grained snapshots.
- **Aggregate catalog** (`entities.json` + `search-index.json`): preferred public read path for
  map/list/search/history/sitemap — one CDN fetch replaces an unbounded Firestore collection scan.
  Emitted by `packages/firebase/scripts/publish-national-catalog.ts` (local fixtures always;
  GCS when `BLAP_UPLOAD_RELEASE_ARTIFACTS=1`).

Rules:

- New release → new object path under new `releaseId`; never overwrite prior release JSON.
- Versioning catches mistaken `gsutil cp` to an existing path during drills.
- Restore verification compares `snapshotHash` in signed manifest to object bytes (see
  `scripts/backup-restore/lib/verification.mjs`).

## Evidence blobs

- `sourceCaptures.snapshotStorageObject` and `evidenceRecords` media refs point at versioned objects.
- Restore drill: pick a capture by `contentHash`, restore prior generation, confirm hash unchanged.

## Soft delete / retention

- Enable **Bucket Lock** or retention policy on `firestore-backups` after legal review (optional).
- Minimum: lifecycle transitions (Nearline/Coldline) per [`retention-matrix.json`](./retention-matrix.json).

## Terraform

Versioning flags are stubbed in [`terraform/backup-bucket.tf.stub`](./terraform/backup-bucket.tf.stub).
Existing `infra/gcp/terraform/buckets.tf` already enables versioning on `private-evidence`; extend
that pattern for `public-media` release prefix policy at apply time.
