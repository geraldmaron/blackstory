# D-014 — Firestore as system of record (not Cloud SQL)

**Date:** 2026-07-16  
**Authoritative user decision:** Do not provision Cloud SQL for the current phase. Keep structured product data in **Firestore**; blobs stay in **Firebase Storage / GCS**. Prefer cost-efficient native Firebase primitives.

## Decision

| Concern | Choice |
|---------|--------|
| Structured entities, claims, evidence **metadata**, releases, submissions, audit, ops | **Cloud Firestore** |
| Binary evidence / media blobs | **Firebase Storage / GCS** (unchanged) |
| Cloud SQL PostgreSQL + PostGIS + Firebase SQL Connect | **Deferred / not production path** for this phase |
| Local PostGIS / SQL Connect templates from BB-012 | **Parked** under `infra/database/` for optional revisit |

Formal ADR: [`docs/adr/ADR-011-firestore-system-of-record.md`](../../docs/adr/ADR-011-firestore-system-of-record.md).  
Supersedes production intent of [ADR-002](../../docs/adr/ADR-002-cloud-sql-postgresql-postgis.md) and [ADR-003](../../docs/adr/ADR-003-firebase-sql-connect-boundaries.md) for the current phase.

## Cost rationale

- Cloud SQL (always-on instance + PostGIS + private networking + backups) is a fixed monthly cost even at low traffic.
- Firestore + Storage scale with usage; emulator-first local development avoids a paid database for day-to-day work.
- SQL Connect / Data Connect adds another managed surface tied to Cloud SQL.

## Geography / search without PostGIS (initial)

- Store **geohash** (and optional prefixes) plus lat/lng on public projection location fields.
- Nearby/bounded queries: geohash range scans + server-side radius filter in `api-public`.
- Text search: bounded Firestore queries / prefix fields first; later optional extension (Algolia/Typesense/Postgres) if measured need.
- Honest tradeoff: weaker ad-hoc spatial joins and FTS than PostGIS; acceptable for beta with approved query shapes (ADR-008 amended by ADR-011).

## Invariants remapped (not dropped)

Anonymous/public clients still never write canonical history; public reads are released projections/snapshots only; submissions stay quarantined until promotion; research cannot publish; living-person rules remain constitution-enforced. Enforcement moves to **Firestore security rules + Admin SDK / SA boundaries** instead of Postgres roles.

## Migration trigger (reconsider Postgres)

Revisit Cloud SQL / PostGIS only if **all** of the following are true:

1. Measured geo/search/query needs exceed Firestore + geohash + bounded API shapes under production-like load.
2. Transactional multi-document integrity for promotion/audit cannot be met with Firestore transactions/batches + outbox patterns.
3. Cost of Cloud SQL is justified by the measured gap (not by preference).

Until then: do not provision paid Cloud SQL.
