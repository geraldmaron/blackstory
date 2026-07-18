# Environment and workload isolation (BB-005, re-split by BB-078)

> **Design target: three-project topology**, per [ADR-012](../adr/ADR-012-production-environment-resplit.md)
> (BB-078), superseding the single-project design D-013 recorded here on 2026-07-16.
> **Live reality is unchanged by this document alone** — the actual migration (creating
> `blackbook-staging`/`blackbook-internal`, moving workloads, applying IAM) is BB-079, not yet
> executed. Until BB-079 applies it, the "Historical: single-project design" section below still
> describes what is live. This document itself only changes what the *target* is; see the "Verified
> live vs. designed" table for exactly what is true today.

**Date:** 2026-07-17 (re-split); originally 2026-07-16
**Depends on:** ADR-005, ADR-006, ADR-009, ADR-011, ADR-012, BB-004
**Implements toward:** BB-010–012, BB-021–027, BB-079, BB-089

## Verified live vs. designed

| Item | Verified/live | Designed, not yet provisioned |
|------|---------------|--------------------------------|
| GCP/Firebase projects | `black-book-efaaf` (project number `332234323945`) is the only live project; Hosting site `black-book-efaaf.web.app` exists | `blackbook-prod` (= `black-book-efaaf`, retained — see ADR-012), `blackbook-staging` (new), `blackbook-internal` (new) |
| Firebase Hosting | `black-book-efaaf.web.app` exists | App content/release state is outside this design |
| Firebase apps | **Blap Web** `1:332234323945:web:17be349ebc9c029b3bfd78`; **Blap Admin** `1:332234323945:web:e1b31c78e32d95943bfd78` | Admin app re-registered under `blackbook-internal` Firebase Auth config at migration time |
| App Hosting | Inventory/creation blocked — project not on Blaze; App Hosting API unavailable | `black-book-web-production` in `blackbook-prod`; `black-book-web-staging` in `blackbook-staging` as its own project (not a same-project namespace) |
| Firestore | Not enabled | `(default)` DB in `blackbook-prod`/`blackbook-staging`; named databases `raw-ingest` and `curated` in `blackbook-internal` (ADR-012) |
| Workload isolation | One live project, no split yet | Three-project split with one-way promotion IAM asymmetry (ADR-012) |

Every cloud resource in `black-book-efaaf` is production today. `development` means local
`demo-repo` emulators and disposable local services — this does not change under ADR-012.
`staging` and `production-research` are **currently** configuration namespaces inside
`black-book-efaaf`, per the historical section below; ADR-012 replaces that with real project
boundaries (`blackbook-staging`, `blackbook-internal`) once BB-079 applies it.

Source of truth:

- [`../../infra/gcp/isolation-matrix.json`](../../infra/gcp/isolation-matrix.json) — machine-readable
  matrix; carries both the live single-project state and the ADR-012 target (`crossProjectGrants`,
  restated `acceptanceCriteria`).
- [`../../infra/gcp/terraform/`](../../infra/gcp/terraform/) — original single-project stubs (unchanged).
- [`../../infra/gcp/terraform/multi-project/`](../../infra/gcp/terraform/multi-project/) — new
  three-project topology stubs (ADR-012, unapplied).
- [`../../infra/gcp/wif/`](../../infra/gcp/wif/) — GitHub OIDC/WIF, extended for per-project deploy
  identities (unapplied).
- [`../../.firebaserc`](../../.firebaserc) — real Firebase aliases for the live project (unchanged by
  this bead; updating it is a human step in the migration runbook).
- [`../../infra/firebase/.firebaserc.example`](../../infra/firebase/.firebaserc.example) — example
  aliases for the target three-project topology.
- [`../../apps/web/apphosting.yaml`](../../apps/web/apphosting.yaml) — production App Hosting config;
  sibling files are explicit templates.

## Target topology (ADR-012): three projects

| Project | Role | Firestore | Buckets | Notable identities |
|---------|------|-----------|---------|---------------------|
| `blackbook-prod` (= `black-book-efaaf`) | Public serving | `(default)`: `public/**` projections + create-only `submissions` | `public-media`, `exports`, `quarantine` | `web-runtime`, `api-public`, `api-submissions`, `github-deploy` |
| `blackbook-staging` | Pre-production mirror, synthetic data only, `minInstances: 0` | `(default)`, same shape as prod | mirrors prod bucket names, staging-prefixed | `github-deploy-staging` (optional) |
| `blackbook-internal` | Research pipeline + admin | Named DBs `raw-ingest`, `curated` (per-DB IAM conditions) | `private-evidence` | `research`, `promotion`, `security`, `admin`, `submissions-puller`, `github-deploy-internal` (optional) |

Local development stays on `demo-repo` emulators — unaffected by any of the above.

### Admin console correction: Cloud Run + IAP, direct attachment

The admin console (`apps/admin`) runs as a plain Cloud Run service in `blackbook-internal`, behind
Identity-Aware Proxy **attached directly to the Cloud Run service** — no external HTTPS load balancer
or serverless NEG is required; that pattern was only necessary before Google Cloud shipped direct IAP
support for Cloud Run. `docs/security/service-surfaces.md` and `infra/gcp/isolation-matrix.json`
already say "Cloud Run + IAP" for admin (not App Hosting — App Hosting backends cannot sit behind IAP
at all, so this was never actually an App Hosting assumption in this repo's docs). The one design that
*does* still assume the older load-balancer mechanism is `infra/gcp/iap/README.md` (BB-027); that
directory is outside this bead's file ownership and needs a follow-up rewrite (tracked in ADR-012's
Consequences).

### One-way promotion IAM asymmetry

See [ADR-012](../adr/ADR-012-production-environment-resplit.md#one-way-promotion-iam-asymmetry) for
the full table. Summary: `promotion@blackbook-internal` is the only identity anywhere — including any
`blackbook-prod`-native identity — that can write `blackbook-prod`'s public projections;
`security@blackbook-internal` promotes scanned uploads into prod's `public-media`/`quarantine`
buckets; `submissions-puller@blackbook-internal` reads prod's create-only `submissions` collection.
**Zero `blackbook-prod` principal holds any IAM binding in `blackbook-internal`.** This is the entire
cross-project grant list — `infra/gcp/isolation-matrix.json`'s `crossProjectGrants` array encodes
exactly these four bindings, and anything not listed there is denied by project boundary, not just by
convention.

### Named Firestore databases in `blackbook-internal`

GA feature, used for pipeline-stage isolation *within* `blackbook-internal`, not as an environment
substitute:

- `raw-ingest` — high-volume research ingestion writes. `research` writes here; nothing else writes
  here.
- `curated` — reviewed/normalized data staged for promotion. Only the curation step (`research`
  reading `raw-ingest`, writing `curated`) and `promotion` (reading `curated`) touch it.

Per-database IAM conditions (`resource.name.startsWith("projects/blackbook-internal/databases/<id>")`)
enforce this boundary; see `infra/gcp/terraform/multi-project/firestore.tf`.

### Secrets, budgets, and the billing kill-switch asymmetry

- **Secret Manager is per project** by construction — `blackbook-prod` holds only production secrets,
  `blackbook-staging` only synthetic/staging secrets, `blackbook-internal` only research/admin/promotion
  secrets. No secret name or value crosses a project boundary; a consumer in one project cannot resolve
  a secret registered in another.
- **Budgets and alerts are per project.** Each project gets its own billing budget and alert
  thresholds (see `infra/gcp/terraform/multi-project/budgets.tf`, gated behind a real billing account
  ID, off by default).
- **Billing kill-switch (automatic hard budget stop) is acceptable on `blackbook-internal` only, and
  must never exist on `blackbook-prod`.** This matches the existing principle in
  `docs/security/cost-resource-controls.md` (`autoDisablePublicCorpus` is hard-coded `false`; research
  is the tier that stops first). `blackbook-staging` may also carry a kill-switch since it serves no
  real users, but `blackbook-prod` may only ever use notify-only budget alerts plus the existing
  scaling caps/rate limits — a cost spike must never be able to silently take public serving dark.

## AC-ISO-1..5 — cross-project invariants (current)

Restated for the ADR-012 target topology. Each still names the historical same-project mechanism
(still true, and still the fallback until BB-079 applies the split) plus the new cross-project
mechanism. Machine encoding: `infra/gcp/isolation-matrix.json` → `acceptanceCriteria[].enforcedBy`.
Test encoding: `infra/gcp/terraform/multi-project/tests/isolation-invariants.test.mjs`.

### AC-ISO-1 — Development credentials cannot access production

- Local development/tests use `demo-repo` emulators (Firestore/Auth/Storage) — unchanged.
- **[Target topology]** `blackbook-staging` gives cloud-based pre-production testing a real project
  boundary from `blackbook-prod` for the first time; this criterion is no longer N/A once BB-079
  applies the split (it was N/A under D-013 because there was only one cloud project).
- `github-deploy` (prod) is WIF-only, protected-context only, project-scoped to `blackbook-prod`; it
  has no exported key and no binding in `blackbook-staging`/`blackbook-internal`.

### AC-ISO-2 — Research workers cannot publish

- `research@...` receives no publication, deployment, service-account impersonation, release-pointer,
  or public-media write permission — unchanged.
- **[Target topology]** `research@blackbook-internal` has no IAM binding in `blackbook-prod` at all
  (not read, not write) — a project-boundary guarantee, not just a role-absence guarantee.
  `promotion@blackbook-internal` is the only identity with a prod write grant, and `promotion` itself
  has no write access to `raw-ingest` (only read on `curated`), so a compromised research adapter
  cannot reach prod by writing into a database `promotion` also writes.

### AC-ISO-3 — Public services cannot read private evidence

- `web-runtime` and `api-public` receive no IAM binding on `private-evidence` — unchanged.
- **[Target topology]** `private-evidence` now lives in `blackbook-internal`, a project
  `web-runtime`/`api-public` (in `blackbook-prod`) have no membership in whatsoever — project boundary
  plus bucket IAM, not bucket IAM alone.

### AC-ISO-4 — Quarantine objects cannot be served publicly

- `quarantine` has PAP enforced and UBLA enabled — unchanged.
- **[Target topology]** `quarantine` stays co-located with the public intake surface in `blackbook-prod`
  (`api-submissions` create-only, unchanged); the only cross-project reader is
  `security@blackbook-internal`, which holds no publish or release-activation grant in any project.

### AC-ISO-5 — Submissions compromise cannot publish

- `api-submissions` holds only quarantine object-create, submissions inbox create, and its own named
  secrets — unchanged.
- **[Target topology]** Even a full `blackbook-prod` project compromise (not just `api-submissions`)
  cannot reach `blackbook-internal` to fabricate a promotion, because promotion is a **pull** initiated
  from `blackbook-internal` (`submissions-puller` reads prod's create-only collection) — there is no
  callable path from prod into internal for an attacker to walk in either direction.

## Migration

Human-executable runbook:
[`../runbooks/production-environment-resplit-migration.md`](../runbooks/production-environment-resplit-migration.md).
Not executed by this document or by BB-078 — tracked as BB-079.

---

## Historical: BB-005 single-project design (superseded 2026-07-17 by ADR-012)

> Kept for the decision trail, per this repo's convention of not deleting recorded decisions. This
> section describes the D-013 single-project design and remains an accurate description of **live**
> state until BB-079 executes the migration above.

### Same-project security boundaries (as designed under D-013)

The project boundary did not separate workloads under D-013. Least privilege was therefore enforced at
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
negative permissions in the matrix. **This is exactly the weakness ADR-012 closes with a real project
boundary; the mechanisms above remain in force as defense-in-depth even after the split.**

### BB-005 acceptance invariants (original text, D-013-era)

#### AC-ISO-1 — Development credentials cannot access production

This criterion was **N/A as a cloud project-separation claim** under D-013: there was only one cloud
project and it was production. The safe replacement was operational:

- local development/tests use `demo-repo` emulators (Firestore/Auth/Storage);
- preflight checks reject production identifiers/endpoints;
- any access to `black-book-efaaf` is explicitly production access;
- `github-deploy` is WIF-only, protected-context only, and has no exported key.
- Optional local PostGIS under `infra/database/` is deferred and not required.

Cloud development or destructive integration testing requires a separate project — this trigger is
now satisfied by ADR-012's `blackbook-staging`.

#### AC-ISO-2 — Research workers cannot publish

- `research@black-book-efaaf.iam.gserviceaccount.com` receives no publication, deployment,
  service-account impersonation, release-pointer, or public-media write permission.
- Research Auth claims / Admin SDK usage cannot write `public/**` or activate releases (Firestore rules + API guards).
- Only `publication` / `api-internal` can promote and activate a release.
- Research jobs have private ingress, bounded concurrency/cost, and an independent kill switch.

#### AC-ISO-3 — Public services cannot read private evidence

- `web-runtime` and `api-public` receive no IAM binding on `private-evidence`.
- `private-evidence` has PAP enforced and UBLA enabled.
- Project-level storage roles are forbidden for runtime SAs.
- Only `research`/`security` write; only `publication`/`admin`/`api-internal` read.

#### AC-ISO-4 — Quarantine objects cannot be served publicly

- `quarantine` has PAP enforced and UBLA enabled.
- `api-submissions` has object-create only; `security` scans/reads.
- No public service, CDN backend, Firebase Storage rule, or signed-URL issuer targets quarantine.

#### AC-ISO-5 — Submissions compromise cannot publish

- `api-submissions` has quarantine object-create, submissions inbox create, and only its named secrets.
- It has no canonical write, evidence read, publication/promotion, deploy, or impersonation grant.
- Promotion requires the separate internal/publication identity and auditable workflow.

### BB-011 checklist for `black-book-efaaf`

Status after BB-011 execution (2026-07-16): apps registered and repo config/rules/package delivered;
cloud backends and GCP IAM/buckets remain blocked on Blaze / `gcloud auth` / human choices. **This
checklist still governs `blackbook-prod` (the retained `black-book-efaaf` project) under ADR-012; it
does not need to be redone for that project, only extended to `blackbook-staging`/`blackbook-internal`
in the migration runbook.**

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
   - Create one Firebase Web app for `apps/web` (suggested display name `Blap Web`).
   - Create a separate Firebase Web app for `apps/admin` (suggested display name
     `Blap Admin`) for Firebase Auth client configuration; do not share admin authorization
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

### Deferred four-project migration plan (original BB-005 target, now superseded by ADR-012's three-project design)

The original BB-005 target topology named these four projects:

```text
blackbook-dev
blackbook-staging
blackbook-prod
blackbook-research-prod
```

ADR-012 rejects reviving `blackbook-dev` as a cloud project (see ADR-012's Rejected Alternatives —
`demo-repo` emulators already give zero-cost local development) and instead adopts three
projects: `blackbook-prod` (= retained `black-book-efaaf`), `blackbook-staging`, `blackbook-internal`
(renamed from `blackbook-research-prod` to also host admin, per ADR-012).

The original re-split triggers (superseded — the split is now happening; kept for record):

- non-production needs cloud credentials, realistic production-derived data, or destructive tests;
- research risk/cost cannot be contained by SA, bucket, DB, network, quota, and kill-switch controls;
- independent billing, residency, org policy, incident containment, or recovery is required;
- compliance or customer commitments require environment-level project boundaries.

Original migration order (superseded by the ADR-012 migration plan and
`docs/runbooks/production-environment-resplit-migration.md`): create projects and org policy →
provision per-project SAs/secrets/buckets → replicate sanitized data → deploy and verify
non-production → move research → move production serving last.

### Deny checklist (still in force; extend, don't replace, under ADR-012)

- [ ] A runtime SA has Owner, Editor, project-wide Storage Admin/Viewer, Token Creator, or broad Service Account User.
- [ ] `research` can write public-media, public projections, or release pointers.
- [ ] `web-runtime` / `api-public` can read private-evidence or quarantine.
- [ ] A private bucket permits `allUsers` / `allAuthenticatedUsers`.
- [ ] `api-submissions` can read evidence or publish/promote.
- [ ] A service-account key exists.
- [ ] Staging is described or used as a production-isolated environment **without actually being a
      separate project** (once `blackbook-staging` exists, this flips: staging must not be described
      as *sharing* prod's project).
- [ ] **(ADR-012)** Any `blackbook-prod` principal resolves any IAM role in `blackbook-internal`.
- [ ] **(ADR-012)** Any identity other than `promotion@blackbook-internal` writes `blackbook-prod`'s
      `public/**` projections.
- [ ] **(ADR-012)** `blackbook-prod` carries an automatic billing kill-switch (budget hard-stop).

## Maintenance

Update the machine matrix, human matrices, Terraform stubs, ADR addenda, and this document together.
Mark a resource live only after a read-only inventory or provisioning verification confirms it.
