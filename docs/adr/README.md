# Architecture Decision Records

Formal decisions for BlackStory platform topology, data, deployment, and security boundaries.

**Bead:**
**Status:** Accepted (existing `black-book-efaaf` project/Hosting site acknowledged; other cloud resources not yet verified/provisioned)
**Date:** 2026-07-16

## How to read these

- **Scaffold today** means the monorepo directories, packages, or local Docker compose already exist.
- **Aspirational / target** means the decision is binding for upcoming beads. Firebase apps, Cloud
  Run, App Hosting backends, and production GitHub Actions are **not** fully provisioned or
  verified yet (see `docs/ds-001/baseline-report.md` and D-013). **Product SoR target is Supabase
  Postgres** (ADR-020); Firestore remains live until cutover. Cloud SQL under `infra/database/`
  stays non-path.
- Do not infer working app or database deployments from the existing Firebase project/Hosting site.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](./ADR-001-firebase-app-hosting-vs-cloud-run.md) | Firebase App Hosting versus separate Cloud Run services | Accepted |
| [ADR-002](./ADR-002-cloud-sql-postgresql-postgis.md) | Cloud SQL PostgreSQL and PostGIS | Superseded (phase) by ADR-011 |
| [ADR-003](./ADR-003-firebase-sql-connect-boundaries.md) | Firebase SQL Connect usage boundaries | Deferred / superseded by ADR-011 |
| [ADR-004](./ADR-004-public-projection-immutable-snapshots.md) | Public projection and immutable publication snapshot model | Accepted |
| [ADR-005](./ADR-005-service-surface-separation.md) | Public, submissions, internal, and admin service separation | Accepted |
| [ADR-006](./ADR-006-github-actions-deployment.md) | GitHub Actions deployment model | Accepted |
| [ADR-007](./ADR-007-background-workflow-model.md) | Background workflow model | Accepted (amended by ADR-018 for discovery schedules) |
| [ADR-008](./ADR-008-search-and-geocoding.md) | Search and geocoding | Accepted (amended by ADR-011) |
| [ADR-009](./ADR-009-research-isolation.md) | Research isolation | Accepted |
| [ADR-010](./ADR-010-security-and-abuse-assumptions.md) | Security and abuse assumptions | Accepted |
| [ADR-011](./ADR-011-firestore-system-of-record.md) | Firestore as system of record (Cloud SQL deferred) | Superseded (SoR path) by ADR-020 |
| [ADR-012](./ADR-012-production-environment-resplit.md) | Production environment re-split (multi-project isolation) | Accepted (supersedes D-013; not yet applied — see ) |
| [ADR-013](./ADR-013-map-stack.md) | Map stack: MapLibre GL JS, PMTiles/MapTiler tile strategy, dark archive basemap | Accepted (demo-level integration; release-activation wiring pending — see ) |
| [ADR-014](./ADR-014-vector-search.md) | Vector search: embedding pipeline and Firestore native KNN | Accepted (on-write/research-pipeline wiring pending — see ) |
| [ADR-015](./ADR-015-entity-ontology-status-notability-era.md) | Entity ontology: status lifecycle, notability basis, era model | Accepted (publication-gate wiring pending — see ) |
| [ADR-016](./ADR-016-jurisdiction-reference-data.md) | Jurisdiction reference data: scope, storage shape, and precision-radius policy | Accepted (dangling-reference gate documented, not live-wired — see ) |
| [ADR-017](./ADR-017-persistent-map-canvas.md) | Persistent map canvas | Accepted |
| [ADR-018](./ADR-018-firebase-scheduled-functions-discovery.md) | Firebase scheduled Functions for discovery automation | Accepted (partially supersedes ADR-007 Jobs-only for capped discovery) |
| [ADR-019](./ADR-019-acquisition-crawler-runtime.md) | Acquisition crawler runtime: TS adapters + Python Scrapy/Trafilatura | Accepted |
| [ADR-020](./ADR-020-supabase-postgres-system-of-record.md) | Supabase Postgres as system of record (`blackstory-app`) | Accepted |
| [ADR-021](./ADR-021-mobile-stack.md) | Mobile stack: Expo, Expo Router, MapLibre Native, RN Firebase App Check, SQLite | Proposed — independent red-team complete, awaiting owner acceptance |
| [ADR-022](./ADR-022-mobile-data-boundary.md) | Mobile data boundary: public contracts package and API v1 versioning | Proposed — independent red-team complete, awaiting owner acceptance |
| [ADR-023](./ADR-023-mobile-state-cache-offline.md) | Mobile state, cache, and offline read policy | Proposed — independent red-team complete, awaiting owner acceptance |
| [ADR-024](./ADR-024-mobile-build-release.md) | Mobile build, release, and OTA update policy | Proposed — independent red-team complete, awaiting owner acceptance |
| [ADR-025](./ADR-025-mobile-map-data.md) | Mobile map data: self-hosted PMTiles, native range requests, attribution, kill-switch, failure strategy | Proposed — awaiting owner acceptance |

## Security boundary set (do not expand)

Deployable surfaces are limited to the bead-defined security boundaries:

| Surface | Runtime (target) | Repo path |
|---------|------------------|-----------|
| Public web | Firebase App Hosting | `apps/web` |
| Public read/search/location API | Cloud Run | `apps/api-public` |
| Submissions / corrections API | Cloud Run | `apps/api-submissions` |
| Internal publication / promotion API | Private Cloud Run | `apps/api-internal` |
| Admin / research console | Cloud Run + IAP | `apps/admin` |
| Research workers | Cloud Run Jobs / Tasks **or** Firebase Functions v2 (research SA; ADR-018) | `workers/research`, `functions/` (discovery schedules) |
| Publication workers | Cloud Run Jobs / Tasks | `workers/publication` |
| Security workers | Cloud Run Jobs / Tasks | `workers/security` |

No ADR proposes additional microservices beyond this set. Shared libraries live in `packages/*` and are not independently deployable.

## Related docs

- [`../architecture.md`](../architecture.md) — architecture overview
- [`../../plan.md`](../../plan.md) — bead tracker
- [`../ds-001/baseline-report.md`](../ds-001/baseline-report.md) — verified scaffold baseline
- [`.cx/decisions/`](../../.cx/decisions/) — short session summaries of these ADRs
