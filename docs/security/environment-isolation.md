# Environment and workload isolation (BB-005)

> Current-state contract for Black Book. One existing Firebase/GCP project is production; workload
> boundaries are designed inside it. The former four-project topology is retained only as a deferred
> migration plan.

**Date:** 2026-07-16  
**Depends on:** ADR-005, ADR-006, ADR-009, BB-004  
**Implements toward:** BB-010–012, BB-021–027

## Current reality: single production project `black-book-efaaf`

| Item | Verified/live | Designed, not yet verified as provisioned |
|------|---------------|--------------------------------------------|
| GCP/Firebase project | `black-book-efaaf` (project number `332234323945`) | — |
| Firebase Hosting | `black-book-efaaf.web.app` exists | App content/release state is outside this design |
| Firebase apps | **Black Book Web** `1:332234323945:web:17be349ebc9c029b3bfd78`; **Black Book Admin** `1:332234323945:web:e1b31c78e32d95943bfd78` | — |
| App Hosting | Inventory/creation blocked — project not on Blaze; App Hosting API unavailable | `black-book-web-production`; optional `black-book-web-staging` after billing approval |
| Workload isolation | One production project is authoritative | Per-surface SAs, bucket IAM, Firestore rules + Auth claims, network policy, quotas, and kill switches |

Every cloud resource in `black-book-efaaf` is production. `development` means local
`demo-black-book` emulators and disposable local services. `staging` may be a separately named App
Hosting backend and resource prefix in the same project, but it is **configuration separation, not a
security, IAM, billing, quota, or recovery boundary**. It must use synthetic data and must never be
used for destructive testing.

Source of truth:

- [`../../infra/gcp/isolation-matrix.json`](../../infra/gcp/isolation-matrix.json) — machine-readable current mode and boundaries.
- [`../../infra/gcp/`](../../infra/gcp/) — human matrices and unapplied Terraform stubs.
- [`../../.firebaserc`](../../.firebaserc) — real Firebase aliases for the one project.
- [`../../apps/web/apphosting.yaml`](../../apps/web/apphosting.yaml) — production App Hosting config; sibling files are explicit templates.

## Same-project security boundaries

The project boundary no longer separates workloads. Least privilege must therefore be enforced at
every lower layer:

1. **Distinct service accounts:** `web-runtime`, `api-public`, `api-submissions`, `api-internal`,
   `admin`, `migrations`, `research`, `publication`, `security`, `backup`, and `github-deploy`.
2. **No broad primitive roles for runtimes:** no runtime receives Owner, Editor, project-wide
   Storage Admin/Viewer, Service Account User, or Token Creator.
3. **Four distinct buckets:** `black-book-efaaf-public-media`,
   `black-book-efaaf-private-evidence`, `black-book-efaaf-exports`, and
   `black-book-efaaf-quarantine`. All use UBLA; every bucket except the deliberate public-media
   delivery path enforces Public Access Prevention.
4. **Firestore rules + Auth claims (BB-013 / ADR-011):** public clients read only `public/**`;
   canonical/evidence/publication/audit writes are Admin SDK only; submissions stay quarantined;
   research claims cannot publish. Parked Postgres roles under `infra/database/` are not the
   production control plane.
5. **Distinct execution/network paths:** public, submissions, internal, admin, research,
   publication, and security surfaces remain separate deployables per ADR-005.
6. **Per-secret IAM:** Secret Manager access is granted on named secrets only. No values or service
   account keys belong in the repository.

Same-project IAM has a larger blast radius than separate projects. In particular, a mistaken
project-level grant can defeat bucket separation. IAM review must reject broad grants and verify the
negative permissions in the matrix.

## BB-005 acceptance invariants

### AC-ISO-1 — Development credentials cannot access production

This criterion is **N/A as a cloud project-separation claim**: there is only one cloud project and it
is production. The safe replacement is operational:

- local development/tests use `demo-black-book` emulators (Firestore/Auth/Storage);
- preflight checks reject production identifiers/endpoints;
- any access to `black-book-efaaf` is explicitly production access;
- `github-deploy` is WIF-only, protected-context only, and has no exported key.
- Optional local PostGIS under `infra/database/` is deferred and not required.

Cloud development or destructive integration testing requires a separate project first.

### AC-ISO-2 — Research workers cannot publish

- `research@black-book-efaaf.iam.gserviceaccount.com` receives no publication, deployment,
  service-account impersonation, release-pointer, or public-media write permission.
- Research Auth claims / Admin SDK usage cannot write `public/**` or activate releases (Firestore rules + API guards).
- Only `publication` / `api-internal` can promote and activate a release.
- Research jobs have private ingress, bounded concurrency/cost, and an independent kill switch.

### AC-ISO-3 — Public services cannot read private evidence

- `web-runtime` and `api-public` receive no IAM binding on `private-evidence`.
- `private-evidence` has PAP enforced and UBLA enabled.
- Project-level storage roles are forbidden for runtime SAs.
- Only `research`/`security` write; only `publication`/`admin`/`api-internal` read.

### AC-ISO-4 — Quarantine objects cannot be served publicly

- `quarantine` has PAP enforced and UBLA enabled.
- `api-submissions` has object-create only; `security` scans/reads.
- No public service, CDN backend, Firebase Storage rule, or signed-URL issuer targets quarantine.

### AC-ISO-5 — Submissions compromise cannot publish

- `api-submissions` has quarantine object-create, submissions inbox create, and only its named secrets.
- It has no canonical write, evidence read, publication/promotion, deploy, or impersonation grant.
- Promotion requires the separate internal/publication identity and auditable workflow.

## BB-011 checklist for `black-book-efaaf`

Status after BB-011 execution (2026-07-16): apps registered and repo config/rules/package delivered;
cloud backends and GCP IAM/buckets remain blocked on Blaze / `gcloud auth` / human choices.

1. **Confirm project state** — Hosting site verified; App Hosting inventory blocked on Blaze.
2. **Register Firebase apps** — **Done** (Web + Admin); see `infra/firebase/registered-apps.json`.
3. **Create App Hosting backends** — **Blocked** pending Blaze + `firebaseapphosting.googleapis.com`.
4. **Create service accounts** — Designed only; needs `gcloud auth login` + human apply.
5. **Create buckets and IAM** — Designed only; not provisioned in BB-011.
6. **Firebase rules and Auth** — Firestore rules enforce public-projection reads + submission
   quarantine (BB-013); Storage remains deny-all for clients. Live Firestore API/database may still
   need enablement; Auth providers not enabled (awaiting human choice).
7. **App Check** — Scaffold/docs only; enforcement is BB-024.
8. **Secrets and deployment** — App Hosting YAML uses Secret Manager names only; WIF design is BB-010 (`infra/gcp/wif/`, declarative; not applied until remote + numeric IDs).
9. **Database boundary handoff** — **Firestore is the system of record (ADR-011 / D-014).** BB-012
   PostGIS/SQL Connect artifacts are parked under `infra/database/`; do not provision Cloud SQL.
   Domain depth continues in BB-014+.

All remaining cloud actions still require human review after `firebase login` / `gcloud auth login`.
Terraform is a plan scaffold only; do not apply it blindly to the live project.

<details>
<summary>Original detailed checklist (reference)</summary>

1. **Confirm project state**
   - Select `black-book-efaaf`; verify project number `332234323945`, billing, owners, and Hosting
     site `black-book-efaaf.web.app`.
   - Inventory existing Firebase apps, App Hosting backends, APIs, service accounts, buckets, IAM,
     secrets, and org-policy inheritance before creating anything.
   - Decide whether to upgrade to Blaze. App Hosting backend inventory/creation is blocked until the
     project is on Blaze and `firebaseapphosting.googleapis.com` can be enabled.
2. **Register Firebase apps**
   - Create one Firebase Web app for `apps/web` (suggested display name `Black Book Web`).
   - Create a separate Firebase Web app for `apps/admin` (suggested display name
     `Black Book Admin`) for Firebase Auth client configuration; do not share admin authorization
     logic with the public app.
   - Record only Firebase's non-secret public web configuration through the approved config path.
     Do not create iOS/Android apps until those clients exist.
3. **Create App Hosting backends**
   - Create `black-book-web-production` in `black-book-efaaf` for `apps/web`.
   - Optionally create `black-book-web-staging` in the same project, with synthetic data and distinct
     config/secret names; label it as non-isolated.
   - Attach `web-runtime@black-book-efaaf.iam.gserviceaccount.com`; disable unreviewed automatic
     production rollouts. Confirm the final App Hosting domain before documenting it.
4. **Create service accounts**
   - Create the eleven identities listed above.
   - Disable service-account key creation where policy authority permits.
   - Do not grant broad project roles. Bind deploy roles only to `github-deploy`; bind
     `iam.serviceAccountUser` only for the exact runtime SAs it must deploy.
5. **Create buckets and IAM**
   - Create the four exact bucket names above in the approved US location with UBLA.
   - Enforce PAP on private-evidence, exports, and quarantine.
   - Keep public-media private behind CDN unless direct public object access is explicitly approved.
   - Apply only the per-SA bindings in `storage-buckets.matrix.md`; verify absent grants for
     `web-runtime`, `api-public`, `api-submissions`, and `research`.
6. **Firebase rules and Auth**
   - Keep Firestore deny-all until reviewed application collections and emulator tests exist.
   - If Firebase Storage is enabled, rules must deny access to server-managed evidence, exports, and
     quarantine; bucket IAM remains authoritative for server workloads.
   - Configure authorized domains and Auth providers minimally; require admin authorization beyond
     authentication and plan IAP for the admin service.
7. **App Check**
   - Register the public Web app with reCAPTCHA Enterprise.
   - Start in metrics/monitoring mode, validate legitimate traffic and token propagation, then
     enforce per supported product/API in BB-024.
   - Admin authorization and server-to-server IAM are not replaced by App Check.
8. **Secrets and deployment**
   - Create named Secret Manager secrets only when a consumer exists (for example
     `web-production-sentry-dsn`); grant access per secret to the consuming SA.
   - Complete WIF apply in BB-010 (`infra/github/scripts/apply-wif.sh`) and protected production approval before enabling `github-deploy` for real rollouts.
   - Do not create JSON keys or place secret values in Firebase config, App Hosting yaml, CI, or repo.
9. **Database boundary handoff**
   - BB-012/013 creates the distinct Postgres roles and private Cloud SQL connectivity.
   - Verify research cannot write public projections, submissions cannot write canonical data, and
     publication cannot alter raw evidence before any production data flow is enabled.

</details>

## Deferred four-project migration plan

The BB-005 target topology remains documented for later migration:

```text
blackbook-dev
blackbook-staging
blackbook-prod
blackbook-research-prod
```

Re-split when any of these becomes true:

- non-production needs cloud credentials, realistic production-derived data, or destructive tests;
- research risk/cost cannot be contained by SA, bucket, DB, network, quota, and kill-switch controls;
- independent billing, residency, org policy, incident containment, or recovery is required;
- compliance or customer commitments require environment-level project boundaries.

Migration order: create projects and org policy → provision per-project SAs/secrets/buckets →
replicate sanitized data → deploy and verify non-production → move research → move production
serving last. Use new per-project WIF identities and never copy SA keys. Until this migration is
completed and verified, no document may describe the four-project design as live.

## Deny checklist

- [ ] A runtime SA has Owner, Editor, project-wide Storage Admin/Viewer, Token Creator, or broad Service Account User.
- [ ] `research` can write public-media, public projections, or release pointers.
- [ ] `web-runtime` / `api-public` can read private-evidence or quarantine.
- [ ] A private bucket permits `allUsers` / `allAuthenticatedUsers`.
- [ ] `api-submissions` can read evidence or publish/promote.
- [ ] A service-account key exists.
- [ ] Staging is described or used as a production-isolated environment.

## Maintenance

Update the machine matrix, human matrices, Terraform stubs, ADR addenda, and this document together.
Mark a resource live only after a read-only inventory or provisioning verification confirms it.
