# Firebase configuration

> **ADR-012 (BB-078) target:** `black-book-efaaf` becomes `blackbook-prod` (retained, not
> recreated); `blackbook-staging` and `blackbook-internal` are new projects. Nothing below in
> this file describes live state changing from this bead alone - the live root `.firebaserc`
> (outside this bead's file ownership) is updated by a human as part of
> [`docs/runbooks/production-environment-resplit-migration.md`](../../docs/runbooks/production-environment-resplit-migration.md).
> [`.firebaserc.example`](./.firebaserc.example) in this directory now shows the target aliases
> (`staging`, `internal`) additively, alongside the unchanged `default`/`production` aliases.

## Production project

The repository root [`.firebaserc`](../../.firebaserc) maps `default` and `production` to the
existing live project `black-book-efaaf`. Project number: `332234323945`. Existing Hosting site:
`black-book-efaaf.web.app`.

Registered web apps (BB-011):

| Display name | App ID | Surface |
|--------------|--------|---------|
| Black Book Web | `1:332234323945:web:17be349ebc9c029b3bfd78` | `apps/web` |
| Black Book Admin | `1:332234323945:web:e1b31c78e32d95943bfd78` | `apps/admin` |

Full SDK identifiers: [`registered-apps.json`](./registered-apps.json). Typed accessors:
`@repo/firebase`.

The alias is a deployment convenience, not authorization to deploy. Use native `firebase login`,
confirm the active account/project, inventory existing resources, and obtain human confirmation
before creating backends or changing production Auth providers.

App Hosting backend inventory/creation is **blocked** until a human upgrades the project to Blaze
and `firebaseapphosting.googleapis.com` can be enabled.

**Public web:** App Hosting configs retired in-repo (ADR-027). Owner deletes
`black-book-web-production` and optional `black-book-web-staging` backends in console.

**Admin (interim):** Live backend `black-book-admin-production` configured via root
[`apphosting.admin.yaml`](../../apphosting.admin.yaml). Target host is Cloud Run + IAP.

## Data plane (ADR-011)

**Firestore** is the system of record for structured product data. **Storage / GCS** holds blobs.
Cloud SQL is deferred — see [`../database/README.md`](../database/README.md) (parked).

Model + rules: [`FIRESTORE_MODEL.md`](./FIRESTORE_MODEL.md), [`firestore.rules`](./firestore.rules),
[`firestore.indexes.json`](./firestore.indexes.json).

BB-018 adds append-only `auditEvents`, transactional `outboxMessages`, idempotency records, and
per-consumer receipts. `@repo/firebase` exposes `commitWithAudit`,
`consumeOutboxMessage`, and `loadEntityPublicationHistory`. Firestore effects and consumer receipts
are atomic; future external consumers must use the event id as their downstream idempotency key.

## Local emulators

Isolated from production via explicit `demo-repo`:

```bash
pnpm firebase:emulators
```

`firebase.json` configures Auth (9099), Firestore (8080), and Storage (9199) emulators plus UI
(4000). Rules tests:

```bash
# with emulators running
pnpm --filter @repo/firebase test
# or CI-style
CI_REQUIRE_FIREBASE=1 pnpm --filter @repo/firebase test
```

## Rules and buckets

| Resource | Repo status | Cloud status |
|----------|-------------|--------------|
| Firestore rules | Boundary + append-only audit rules in [`firestore.rules`](./firestore.rules) (BB-013/018) | API/database is disabled — do not deploy until database location/edition is chosen |
| Firestore indexes | [`firestore.indexes.json`](./firestore.indexes.json) | Deploy with rules when database exists |
| Firebase Storage rules | deny-all in [`storage.rules`](./storage.rules) | Default bucket name appears in SDK config; enable/provision separately |
| GCP class buckets | designed in `infra/gcp/storage-buckets.matrix.md` | Not provisioned (needs `gcloud auth` + confirmation) |

## Auth and App Check

See [`auth-and-app-check.md`](./auth-and-app-check.md). Providers not enabled (human choice).
App Check enforcement is BB-024.

## IAM

Minimal Firebase-facing IAM design: [`iam-minimal.md`](./iam-minimal.md). No keys. Full SA matrix:
[`../gcp/service-accounts.matrix.md`](../gcp/service-accounts.matrix.md).

## App Hosting templates

| File | Purpose |
|------|---------|
| [`../../apphosting.admin.yaml`](../../apphosting.admin.yaml) | Live admin backend `black-book-admin-production` |

Public web App Hosting configs (`apps/web/apphosting*.yaml`) were retired when Vercel became the
sole public host (ADR-027). Set the admin backend runtime identity at creation to
`admin-runtime@black-book-efaaf.iam.gserviceaccount.com`. YAML contains Secret Manager names only for
server secrets; public Firebase client identifiers are plain env values.

## Backup and restore (BB-020)

Firestore export schedule, retention matrix, PITR design, IAM deny-delete notes, and Terraform/gcloud
stubs: [`backup/`](./backup/). Operator runbook:
[`../../docs/runbooks/backup-restore.md`](../../docs/runbooks/backup-restore.md). Verification scripts
(dry-run default): [`../../scripts/backup-restore/`](../../scripts/backup-restore/).
