# IAM backup protection (BB-020)

Designed grants for `black-book-efaaf`. **Do not apply without human review.** Ordinary runtime
service accounts **must not** delete backup objects or Firestore export metadata.

## Backup bucket

| Bucket | PAP | Versioning | Writers | Readers | Deleters |
|--------|-----|------------|---------|---------|----------|
| `black-book-efaaf-firestore-backups` | enforced | **enabled** | `backup@` only (`objectCreator` + `legacyBucketWriter` for multipart) | `backup@`, break-glass humans | **Lifecycle rules only**; no runtime SA |

## Service account matrix

| Principal | Firestore / export | Backup bucket | Must NOT have |
|-----------|-------------------|---------------|---------------|
| `backup@` | `roles/datastore.importExportAdmin` (export/import runner) | `roles/storage.objectAdmin` scoped to backup bucket | `datastore.user` write; canonical collections write; publish |
| `publication@` | — | — | Any backup bucket access |
| `research@` | — | — | Backup bucket; export admin |
| `web-runtime@` | — | — | Backup bucket; `storage.objects.delete` anywhere |
| `api-public@` | — | — | Backup bucket |
| `api-internal@` | — | `exports` bucket write (user exports, not backups) | Backup bucket |
| `security@` | — | evidence/quarantine admin | Backup bucket delete |
| `admin@` | — | evidence read | Backup delete (read-only audit optional) |
| `github-deploy@` | — | — | Backup bucket; Firestore export |
| Human break-glass | Import for DR drills | `storage.objectAdmin` (time-boxed) | Standing delete permission |

## Deny-delete conditions (design)

Apply IAM **deny policies** or conditional bindings so runtime identities cannot delete backup
objects even if a misconfiguration grants broad Storage Admin:

```json
{
  "displayName": "deny-runtime-backup-delete",
  "rules": [
    {
      "description": "Block object delete on firestore-backups bucket for runtime SAs",
      "denyRule": {
        "deniedPrincipals": [
          "principal://iam.googleapis.com/projects/332234323945/locations/global/workloadIdentityPools/black-book/sa/web-runtime",
          "principal://iam.googleapis.com/projects/332234323945/locations/global/workloadIdentityPools/black-book/sa/api-public"
        ],
        "deniedPermissions": ["storage.googleapis.com/objects.delete"],
        "denialCondition": {
          "title": "backup-bucket-only",
          "expression": "resource.name.startsWith('projects/_/buckets/black-book-efaaf-firestore-backups/')"
        }
      }
    }
  ]
}
```

**Practical stub:** bind explicit `storage.objectViewer` + `storage.objectCreator` (no Admin) on
`backup@` and omit `storage.objects.delete` via custom role — see
[`terraform/backup-iam.tf.stub`](./terraform/backup-iam.tf.stub).

Expand denied principals to **all** runtime SAs in
[`infra/gcp/service-accounts.matrix.md`](../../gcp/service-accounts.matrix.md) except `backup@`.

## Firestore export permissions

`backup@` requires:

- `roles/datastore.importExportAdmin` — start export/import operations
- `roles/storage.objectAdmin` on `black-book-efaaf-firestore-backups` only

`backup@` must **not** receive:

- `roles/datastore.owner` or project Editor
- `roles/firebase.admin`
- Access to `private-evidence`, `quarantine`, or `public-media` buckets (metadata verification uses
  export sidecars, not live bucket listing from backup job)

## Verification (quarterly)

1. Attempt `gcloud storage rm` with `web-runtime@` credentials → expect **403**.
2. Attempt delete with `backup@` → expect **403** (creator without delete).
3. Confirm lifecycle rule deletion still works on aged `exports/daily/` prefixes.

Evidence in repo: [`scripts/backup-restore/verify-iam-matrix.mjs`](../../../scripts/backup-restore/verify-iam-matrix.mjs)
(dry-run parses [`retention-matrix.json`](./retention-matrix.json) + IAM doc).
