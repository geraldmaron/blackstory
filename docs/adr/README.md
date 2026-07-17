# Architecture Decision Records

Formal decisions for Black Book platform topology, data, deployment, and security boundaries.

**Bead:** BB-002  
**Status:** Accepted (existing `black-book-efaaf` project/Hosting site acknowledged; other cloud resources not yet verified/provisioned)  
**Date:** 2026-07-16

## How to read these

- **Scaffold today** means the monorepo directories, packages, or local Docker compose already exist.
- **Aspirational / target** means the decision is binding for upcoming beads. Firebase apps, Cloud
  Run, App Hosting backends, and production GitHub Actions are **not** fully provisioned or
  verified yet (see `docs/bb-001/baseline-report.md` and D-013). **Cloud SQL is deferred** (ADR-011).
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
| [ADR-007](./ADR-007-background-workflow-model.md) | Background workflow model | Accepted |
| [ADR-008](./ADR-008-search-and-geocoding.md) | Search and geocoding | Accepted (amended by ADR-011) |
| [ADR-009](./ADR-009-research-isolation.md) | Research isolation | Accepted |
| [ADR-010](./ADR-010-security-and-abuse-assumptions.md) | Security and abuse assumptions | Accepted |
| [ADR-011](./ADR-011-firestore-system-of-record.md) | Firestore as system of record (Cloud SQL deferred) | Accepted |
| [ADR-012](./ADR-012-production-environment-resplit.md) | Production environment re-split (multi-project isolation) | Accepted (supersedes D-013; not yet applied — see BB-079) |
| [ADR-013](./ADR-013-map-stack.md) | Map stack: MapLibre GL JS, PMTiles/MapTiler tile strategy, dark archive basemap | Accepted (demo-level integration; release-activation wiring pending — see BB-051) |

## Security boundary set (do not expand)

Deployable surfaces are limited to the bead-defined security boundaries:

| Surface | Runtime (target) | Repo path |
|---------|------------------|-----------|
| Public web | Firebase App Hosting | `apps/web` |
| Public read/search/location API | Cloud Run | `apps/api-public` |
| Submissions / corrections API | Cloud Run | `apps/api-submissions` |
| Internal publication / promotion API | Private Cloud Run | `apps/api-internal` |
| Admin / research console | Cloud Run + IAP | `apps/admin` |
| Research workers | Cloud Run Jobs / Tasks | `workers/research` |
| Publication workers | Cloud Run Jobs / Tasks | `workers/publication` |
| Security workers | Cloud Run Jobs / Tasks | `workers/security` |

No ADR proposes additional microservices beyond this set. Shared libraries live in `packages/*` and are not independently deployable.

## Related docs

- [`../architecture.md`](../architecture.md) — architecture overview
- [`../../plan.md`](../../plan.md) — bead tracker
- [`../bb-001/baseline-report.md`](../bb-001/baseline-report.md) — verified scaffold baseline
- [`.cx/decisions/`](../../.cx/decisions/) — short session summaries of these ADRs
