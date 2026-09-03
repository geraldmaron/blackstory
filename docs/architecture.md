# BlackStory architecture

> Formal ADRs were cleared 2026-07-24 (decision-doc purge). Still-binding invariants live in
> `docs/decisions-carryover.md`. Historical ADR filenames remain in git (`git log -- docs/adr/`).

## Current stack (verified 2026-08-28)

Checked against live https://blackstory.app/ (`x-vercel-id`, `x-vercel-cache`,
`va.vercel-scripts.com` / `vitals.vercel-insights.com`, Cloudflare `server` header, CSP
`img-src` including `https://twykhihqkcldpreuovay.supabase.co` and leftover
`https://storage.googleapis.com`). This is the current story. Older runbooks that still name
Firebase App Hosting or Firestore as SoR are leftover.

| Layer | Current | Leftover |
|-------|---------|----------|
| Public web | Vercel (Cloudflare in front) | Firebase App Hosting, Cloud Run for `apps/web` |
| Admin | Separate Vercel project (`apps/admin/vercel.json`) | Deleted App Hosting / Cloud Run `black-book-admin-production` |
| Data | Supabase Postgres `blackstory-app` (`twykhihqkcldpreuovay.supabase.co`) | Firestore, parked PostGIS / Cloud SQL |
| Media | Supabase Storage `public-media` | GCS dual-serve (`storage.googleapis.com` still in CSP) |

**Live** https://blackstory.app/ (verified 2026-08-28) is still the old catalog filter board
(Kind / Tone / Era / Theme / Status / Confidence / Where), about 4,100 released records.
That is production today. It is not yet the first-run sat below.

**Intended first-run**, sat 2026-08-28 on isolated branch `cursor/first-paint-local-119c` at
localhost:3048 (commit `0dfc8f5a`): Greenwood first; header rooms are Explore and Rooms only;
no Journey room; no Grade A; no "2 sources"; `/?atlas=1` 308s home. That chrome is not live
until that isolated work lands. Do not invent a Journey page. Do not restyle first paint here.

`/journey` is unfinished. Apex and www return HTTP 404 (verified 2026-08-28). Do not add it
to nav, about, sitemap, or in-app links. Do not list Journey as a room. There is no public
Journey source beyond that 404.

`/records/42Cb1758` is not a published record (HTTP 404, verified 2026-08-28). Record pages
are `/entity/<id>`. Live production can still show that id as a list title. Intended
first-run does not. Do not invent the page.

This repo only configures Supabase project `blackstory-app`. Other org Pro projects are not in
this config, so unused is not proven here. Docs agreement is not a billing close.

Cover-package work belongs on administration-app, not this repo.

## System overview

BlackStory is a place-connected Black history research platform. Public surfaces serve only
released historical projections. Research, evidence, and promotion stay behind private APIs,
workers, and admin tools.

## Surfaces

```
apps/web                 Public Next.js on Vercel (live: blackstory.app)
apps/admin               Private Next.js admin/research (separate Vercel project)
apps/api-public          Public read/search/location API (in-repo; Cloud Run deploy unverified)
apps/api-submissions     Corrections / contribution intake (in-repo; Cloud Run deploy unverified)
apps/api-internal        Publication / promotion / internal control (in-repo; Cloud Run deploy unverified)
apps/docs                Public docs site (GitHub Pages static export)
apps/mobile              Expo mobile (isolated lockfile)
workers/research         Research compute
workers/publication      Projection, snapshot, indexing, release
workers/security         Quarantine, content validation, integrity
packages/*               Shared TypeScript libraries
supabase/                Postgres migrations for blackstory-app
infra/*                  Leftover Firebase/GCP scaffolding, GitHub, parked PostGIS
```

`functions/` (Firebase Cloud Functions v2 schedules) was deleted. Scheduling moved to
`.github/workflows/discovery-campaigns.yml`. Do not add deployable microservices beyond this
set. Historical ADR-005 text is in git history.

## Platform (live vs leftover)

- **Data:** Supabase Postgres on `blackstory-app` is the product system of record. Public media
  is Supabase Storage. GCS dual-serve and Firestore export tools are leftover
  (`docs/data/firebase-wind-down.md`, `docs/data/supabase-storage-cutover.md`). Parked Cloud SQL
  / PostGIS under `infra/database/` is leftover, not the production path.
- **App data access:** Postgres via server `DATABASE_URL` / `@repo/data-access` on Vercel.
  PostgREST published views remain the developer-read design. `@repo/firebase` keeps App Check
  helper types only. Do not add Firestore SoR access.
- **Public web:** Vercel for `apps/web`. Admin is its own Vercel project. Firebase App Hosting
  backends for web and admin were deleted. Cloud Run for the in-repo APIs is leftover target
  text; this repo has no verified production Cloud Run deploy for them
  (`docs/runbooks/api-public-cloud-run.md`).
- **Auth / abuse:** Supabase Auth for admin (`app_metadata.bb_role`); request-integrity / client
  headers for public mutations. App Check is retired on the public request path.
- **Jobs / CI:** Discovery on GitHub Actions. WIF apply under `infra/gcp/wif/` is leftover
  scaffolding. Do not provision Cloud SQL. Do not dual-write canonical truth to Firestore.

## Boundaries

| Concern | Rule |
|---------|------|
| Canonical write | Never from anonymous or public clients |
| Public read | Released projections / immutable snapshots only ([ADR-004](./adr/ADR-004-public-projection-immutable-snapshots.md)) |
| Promotion | Required before any submission becomes public |
| Research / LLM | Cannot publish; public render never calls an LLM |
| Living persons | No public residential addresses; unknown living status treated as living |
| External URLs | Untrusted; no synchronous fetch in user requests |
| Credentials | Public API read-only on public projections; research ≠ publication |
| Product policy | Versioned constitution only; not mutable via public endpoints |

## Product constitution

Single source of truth: `packages/schemas/constitution/policy.v1.json`, validated by
`product-constitution.schema.json`.

| Consumer | Package | Role |
|----------|---------|------|
| TypeScript apps/packages | `@repo/schemas` | Zod-validated loaders + evaluators |
| Python workers | `black_book_constitution` | jsonschema-validated loaders + evaluators |

Do not hard-code relevance/confidence thresholds, precision rules, or living-person rules in apps.
Policy changes are version bumps in the shared JSON, never a public write API.

## Security threat model

Hostile-environment design is documented under [`docs/security/`](./security/). Assumptions remain
binding in [ADR-010](./adr/ADR-010-security-and-abuse-assumptions.md).

## Environment isolation

Single-project GCP design (partially applied): [`security/environment-isolation.md`](./security/environment-isolation.md).
Matrices and Terraform stubs: [`../infra/gcp/`](../infra/gcp/). Root `.firebaserc` was deleted in
`repo-348e.8` (no Firestore/Firebase Hosting deploy target remains); the production Firebase
project id (`black-book-efaaf`) that App Check still targets is documented in
`infra/firebase/registered-apps.json` and `apps/admin`'s Cloud Run env, not in a `.firebaserc`.

| Acceptance | Design enforcement |
|------------|--------------------|
| Dev credentials cannot access production | Development is local/emulator-oriented; tests fail closed against production identifiers |
| Research workers cannot publish | Distinct research credentials; no release activation |
| Public services cannot read private evidence | Bucket/RLS boundaries; no broad storage roles on public SAs |
| Submissions compromise ≠ publish | Intake writes quarantine only |

## Key decisions

Formal ADRs (public web host, projections/snapshots, service separation, search/geocoding,
security assumptions, Firestore→Supabase SoR migration, vector search, PostgREST reads, Vercel
hosting, discovery schedules, etc.) were removed 2026-07-24 as part of a decision-doc purge —
history is preserved in git (`git log -- docs/adr/`). Still-binding invariants extracted from
them are captured in [`docs/decisions-carryover.md`](./decisions-carryover.md).
