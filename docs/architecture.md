# BlackStory architecture

> Required project state. Formal ADRs were cleared 2026-07-24 (decision-doc purge, `repo-xez5.11`);
> still-binding invariants extracted from them live in `docs/decisions-carryover.md`.

## System overview

BlackStory is a place-connected Black history research platform. Public surfaces serve only
released historical projections. Research, evidence, and promotion stay behind private APIs,
workers, and admin tools.

## Target surfaces

```
apps/web                 Public Next.js (Vercel — ADR-027)
apps/admin               Private Next.js admin/research (App Hosting interim; Cloud Run + IAP — target)
apps/api-public          Public read/search/location API (Cloud Run)
apps/api-submissions     Corrections / contribution intake (Cloud Run)
apps/api-internal        Publication / promotion / internal control (private Cloud Run)
apps/docs                Public docs site (GitHub Pages static export)
apps/mobile              Expo mobile (isolated lockfile)
workers/research         Research compute (Corsair schedules + Jobs/Tasks when applied)
workers/publication      Projection, snapshot, indexing, release
workers/security         Quarantine, content validation, integrity
packages/*               Shared TypeScript libraries
supabase/                Postgres migrations and project config
infra/*                  GCP, GitHub scaffolding; infra/firebase/ keeps only the App Check
                          reference docs, the backup/DR archive, and registered-apps.json
```

`functions/` (the 5 Firebase Cloud Functions v2 schedules, ADR-018) was deleted `repo-348e.8`;
its scheduling role moved to `.github/workflows/discovery-campaigns.yml` (ADR-028).

Do not add deployable microservices beyond this set. See [ADR-005](./adr/ADR-005-service-surface-separation.md).

## Platform intent (live)

- **Data:** **Supabase Postgres** on `blackstory-app` is the product system of record
  ([ADR-020](./adr/ADR-020-supabase-postgres-system-of-record.md)). Blobs: Supabase Storage for
  `public-media` (GCS dual-serve / rollback). Firestore itself is gone — no live database, rules,
  or indexes remain (`docs/data/firebase-wind-down.md`). Cloud SQL / SQL Connect under
  `infra/database/` stay parked.
- **App data access:** Postgres via server `DATABASE_URL` / `@repo/data-access`; PostgREST
  published views ([ADR-026](./adr/ADR-026-postgrest-published-read-surface.md)); `@repo/domain`
  models. `@repo/firebase` remains only for Firebase App Check client/verification helpers and
  embedding utilities — not for any Firestore/Firebase SoR access, which no longer exists.
- **Public web vs APIs:** Vercel for `apps/web` ([ADR-027](./adr/ADR-027-vercel-public-web-hosting.md));
  Cloud Run for APIs + admin ([ADR-001](./adr/ADR-001-firebase-app-hosting-vs-cloud-run.md)).
- **Auth / abuse:** Supabase Auth for admin (`app_metadata.bb_role`); request-integrity / client
  headers for public mutations; App Check retired on mobile/`api-public`
  ([ADR-010](./adr/ADR-010-security-and-abuse-assumptions.md)).
- **Ingress:** Cloud Armor / ALB / CDN — staged where applied.
- **Jobs:** Cloud Tasks + Cloud Run Jobs for long batch ([ADR-007](./adr/ADR-007-background-workflow-model.md));
  capped discovery on **Corsair systemd + Postgres** ([ADR-028](./adr/ADR-028-discovery-schedule-runtime.md)).
- **CI/CD:** GitHub Actions ([ADR-006](./adr/ADR-006-github-actions-deployment.md)); WIF apply still
  staged under `infra/gcp/wif/`.
- **Search / geo:** Postgres/PostGIS + bounded `api-public` queries; U.S. Census Geocoder
  ([ADR-008](./adr/ADR-008-search-and-geocoding.md)). Vectors: `pgvector` ([ADR-014](./adr/ADR-014-vector-search.md)).
- **Research isolation:** Research cannot publish ([ADR-009](./adr/ADR-009-research-isolation.md)).
- **Observability:** OpenTelemetry + Sentry packages stubbed where not yet wired.

Do **not** provision Cloud SQL. Do not dual-write new canonical truth to Firestore.

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
