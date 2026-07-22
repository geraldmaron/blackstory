# Architecture Decision Records

Formal decisions for BlackStory platform topology, data, deployment, and security boundaries.

**Status:** Living index (product SoR is Supabase Postgres; see ADR-020)
**Last reconciled:** 2026-07-22

## How to read these

- **Scaffold today** means the monorepo directories, packages, or local tooling already exist.
- **Target** means the decision is binding for how we ship. Cloud resources called out as
  "not applied" or "wind-down open" are still operationally incomplete; do not invent them.
- **Product system of record** is **Supabase Postgres** on project `blackstory-app` (ADR-020).
  Firestore is a **historical phase** and rollback/export surface only (ADR-011 superseded;
  see `docs/data/firebase-wind-down.md`).
- **Public web** is **Vercel** only (ADR-027). Public web App Hosting configs are retired in-repo.
- **Admin** interim host is **App Hosting** (`black-book-admin-production`) until Cloud Run + IAP.
- Filenames keep historical names for link stability. Titles and status lines are authoritative.
- Cite ADR numbers and capability names. Do not put internal tracker ids in ADR chrome.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](./ADR-001-firebase-app-hosting-vs-cloud-run.md) | Public web host versus Cloud Run services | Accepted (amended by ADR-027) |
| [ADR-002](./ADR-002-cloud-sql-postgresql-postgis.md) | Cloud SQL PostgreSQL and PostGIS | Superseded (by ADR-011, then ADR-020; Cloud SQL remains non-path) |
| [ADR-003](./ADR-003-firebase-sql-connect-boundaries.md) | Firebase SQL Connect usage boundaries | Superseded by ADR-020 (SQL Connect permanently non-path) |
| [ADR-004](./ADR-004-public-projection-immutable-snapshots.md) | Public projection and immutable publication snapshot model | Accepted |
| [ADR-005](./ADR-005-service-surface-separation.md) | Public, submissions, internal, and admin service separation | Accepted |
| [ADR-006](./ADR-006-github-actions-deployment.md) | GitHub Actions deployment model | Accepted (amended 2026-07-22) |
| [ADR-007](./ADR-007-background-workflow-model.md) | Background workflow model | Accepted (discovery schedules: ADR-028) |
| [ADR-008](./ADR-008-search-and-geocoding.md) | Search and geocoding | Accepted (amended by ADR-020) |
| [ADR-009](./ADR-009-research-isolation.md) | Research isolation | Accepted |
| [ADR-010](./ADR-010-security-and-abuse-assumptions.md) | Security and abuse assumptions | Accepted (amended 2026-07-22) |
| [ADR-011](./ADR-011-firestore-system-of-record.md) | Firestore as system of record (historical phase) | Superseded by ADR-020 |
| [ADR-012](./ADR-012-production-environment-resplit.md) | Production environment re-split (multi-project isolation) | Accepted (not yet applied) |
| [ADR-013](./ADR-013-map-stack.md) | Map stack: MapLibre GL JS, PMTiles, dark archive basemap | Accepted |
| [ADR-014](./ADR-014-vector-search.md) | Vector search: embedding pipeline and Postgres pgvector | Accepted (amended by ADR-020) |
| [ADR-015](./ADR-015-entity-ontology-status-notability-era.md) | Entity ontology: status lifecycle, notability basis, era model | Accepted |
| [ADR-016](./ADR-016-jurisdiction-reference-data.md) | Jurisdiction reference data: scope, storage shape, precision-radius policy | Accepted |
| [ADR-017](./ADR-017-persistent-map-canvas.md) | Persistent map canvas | Accepted |
| [ADR-018](./ADR-018-firebase-scheduled-functions-discovery.md) | Firebase scheduled Functions for discovery automation | Superseded by ADR-028 |
| [ADR-019](./ADR-019-acquisition-crawler-runtime.md) | Acquisition crawler runtime: TS adapters + Python Scrapy/Trafilatura | Accepted |
| [ADR-020](./ADR-020-supabase-postgres-system-of-record.md) | Supabase Postgres as system of record (`blackstory-app`) | Accepted |
| [ADR-021](./ADR-021-mobile-stack.md) | Mobile stack: Expo, Expo Router, MapLibre Native, SQLite | Accepted |
| [ADR-022](./ADR-022-mobile-data-boundary.md) | Mobile data boundary: public contracts package and API v1 versioning | Accepted |
| [ADR-023](./ADR-023-mobile-state-cache-offline.md) | Mobile state, cache, and offline read policy | Accepted |
| [ADR-024](./ADR-024-mobile-build-release.md) | Mobile build, release, and OTA update policy | Accepted |
| [ADR-025](./ADR-025-mobile-map-data.md) | Mobile map data: self-hosted PMTiles, attribution, kill-switch | Accepted |
| [ADR-026](./ADR-026-postgrest-published-read-surface.md) | PostgREST published-read surface (dual-surface with `api-public`) | Accepted |
| [ADR-027](./ADR-027-vercel-public-web-hosting.md) | Vercel for public web hosting | Accepted (amended 2026-07-22) |
| [ADR-028](./ADR-028-discovery-schedule-runtime.md) | Discovery schedule runtime: Corsair systemd + Postgres | Accepted |

## Security boundary set (do not expand)

Deployable surfaces are limited to this set:

| Surface | Runtime (live / target) | Repo path |
|---------|-------------------------|-----------|
| Public web | Vercel (ADR-027) | `apps/web` |
| Public read/search/location API | Cloud Run | `apps/api-public` |
| Submissions / corrections API | Cloud Run | `apps/api-submissions` |
| Internal publication / promotion API | Private Cloud Run | `apps/api-internal` |
| Admin / research console | App Hosting interim (`black-book-admin-production`); target Cloud Run + IAP | `apps/admin` |
| Research / discovery schedules | Corsair systemd + Postgres (ADR-028); long batch via Cloud Run Jobs/Tasks when applied (ADR-007) | `workers/research`, `functions/` (tombstone) |
| Publication workers | Cloud Run Jobs / Tasks (target) | `workers/publication` |
| Security workers | Cloud Run Jobs / Tasks (target) | `workers/security` |

No ADR proposes additional microservices beyond this set. Shared libraries live in `packages/*` and are not independently deployable.

## Related docs

- [`../architecture.md`](../architecture.md): architecture overview
- [`../data/postgres-schema.md`](../data/postgres-schema.md): Postgres schema
- [`../data/firebase-wind-down.md`](../data/firebase-wind-down.md): Firebase rollback / export checklist
- [`../ds-001/baseline-report.md`](../ds-001/baseline-report.md): early scaffold baseline (historical)
