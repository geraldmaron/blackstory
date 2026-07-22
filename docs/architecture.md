# BlackStory architecture

> Required project state. Keep this file aligned with live ADRs under `docs/adr/`.

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
functions/               Tombstone (ADR-018 superseded by ADR-028)
packages/*               Shared TypeScript libraries
supabase/                Postgres migrations and project config
infra/*                  Firebase wind-down, GCP, GitHub scaffolding
```

Do not add deployable microservices beyond this set. See [ADR-005](./adr/ADR-005-service-surface-separation.md).

## Platform intent (live)

- **Data:** **Supabase Postgres** on `blackstory-app` is the product system of record
  ([ADR-020](./adr/ADR-020-supabase-postgres-system-of-record.md)). Blobs: Supabase Storage for
  `public-media` (GCS dual-serve / rollback). Firestore is export/rollback only
  (`docs/data/firebase-wind-down.md`). Cloud SQL / SQL Connect under `infra/database/` stay parked.
- **App data access:** Postgres via server `DATABASE_URL` / `@repo/data-access`; PostgREST
  published views ([ADR-026](./adr/ADR-026-postgrest-published-read-surface.md)); `@repo/domain`
  models. `@repo/firebase` remains for utilities / migration / GCS helpers, not SoR.
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
Matrices and Terraform stubs: [`../infra/gcp/`](../infra/gcp/). Root `.firebaserc` still names
production `black-book-efaaf` for wind-down/rollback surfaces.

| Acceptance | Design enforcement |
|------------|--------------------|
| Dev credentials cannot access production | Development is local/emulator-oriented; tests fail closed against production identifiers |
| Research workers cannot publish | Distinct research credentials; no release activation |
| Public services cannot read private evidence | Bucket/RLS boundaries; no broad storage roles on public SAs |
| Submissions compromise ≠ publish | Intake writes quarantine only |

## Key decisions

Formal ADRs: [`docs/adr/`](./adr/README.md).

| ADR | Topic |
|-----|-------|
| [001](./adr/ADR-001-firebase-app-hosting-vs-cloud-run.md) | Public web host vs Cloud Run |
| [004](./adr/ADR-004-public-projection-immutable-snapshots.md) | Public projections + immutable snapshots |
| [005](./adr/ADR-005-service-surface-separation.md) | Public / submissions / internal / admin separation |
| [008](./adr/ADR-008-search-and-geocoding.md) | Search and geocoding (Postgres) |
| [010](./adr/ADR-010-security-and-abuse-assumptions.md) | Security and abuse assumptions |
| [011](./adr/ADR-011-firestore-system-of-record.md) | Firestore SoR (**superseded** by 020) |
| [014](./adr/ADR-014-vector-search.md) | Vector search (`pgvector`) |
| [020](./adr/ADR-020-supabase-postgres-system-of-record.md) | Supabase Postgres SoR |
| [026](./adr/ADR-026-postgrest-published-read-surface.md) | PostgREST published reads |
| [027](./adr/ADR-027-vercel-public-web-hosting.md) | Vercel public web |
| [028](./adr/ADR-028-discovery-schedule-runtime.md) | Corsair discovery schedules |

Full index: [`adr/README.md`](./adr/README.md).
