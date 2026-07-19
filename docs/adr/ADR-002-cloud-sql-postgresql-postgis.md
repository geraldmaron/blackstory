# ADR-002: Cloud SQL PostgreSQL and PostGIS

- **Status:** Superseded (current phase) by [ADR-011](./ADR-011-firestore-system-of-record.md) / [D-014](../../.cx/decisions/D-014-firestore-not-cloud-sql.md)
- **Date:** 2026-07-16
- **Bead:**
- **Depends on:** ADR-001 (runtime surfaces), ADR-004 (projections), ADR-009 (research isolation)

> **Phase note (2026-07-16):** Cloud SQL / PostGIS is **not** the production system of record.
> Artifacts under `infra/database/` are **parked** for a possible later revisit. Do not provision
> paid Cloud SQL unless ADR-011 migration triggers are met.

## Scaffold vs target

| Aspect | Today (verified) | Former target (parked) |
|--------|------------------|------------------------|
| Local DB | `infra/database/` — PostGIS 16 compose + init (optional/deferred) | Same engine family if Postgres revisited |
| Cloud SQL | **Not provisioned; not production path** | Private-IP Cloud SQL PostgreSQL + PostGIS |
| Migrations / schemas | Boundary stubs only; **no further SQL migrations** | Would have been + |
| Backups / PITR | N/A for Cloud SQL this phase |  if Postgres returns |

Local compose is **not** Cloud SQL. Do not treat Docker Postgres as production-equivalent connectivity, IAM, or HA.

## Context

The product is place-connected historical data: entities, geography, evidence, claims, and public projections. Spatial queries (nearby discovery, historical geography) and bounded full-text search are first-class. A single relational store with PostGIS and PostgreSQL FTS/pg_trgm avoids early multi-store complexity while preserving strong transactional boundaries for promotion and audit.

## Decision

1. **Canonical and projection data** live in **Cloud SQL PostgreSQL with PostGIS**.
2. **Local development** uses the PostGIS 16 Docker service in `infra/database/`.
3. Prefer **PostgreSQL FTS, `pg_trgm`, and PostGIS** for search and geo before introducing a separate search platform (ADR-008).
4. Schema and role boundaries separate public / research / publication / audit access (; ADR-003, ADR-009).
5. Python workers may use **direct least-privilege PostgreSQL** connections; TypeScript app servers prefer Firebase SQL Connect where authorized (ADR-003).

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Firestore / Document DB as system of record | Weak relational integrity for claims↔evidence↔releases; spatial and FTS weaker fit. |
| MySQL / non-PostGIS Postgres | Insufficient first-class geography for place-connected product. |
| Managed Elasticsearch/OpenSearch from day one | Premature; beads require Postgres search first; adds another abuse/cost surface. |
| Separate DB per microservice | Over-decomposition; one logical Cloud SQL with role/schema isolation matches bead model. |
| SQLite / embedded for production | Cannot meet concurrent API, spatial, and HA/backup requirements. |

## Consequences

- One primary datastore to operate, back up, and restore; schema discipline becomes critical.
- Local PostGIS version should stay close to Cloud SQL major version (16 family today).
- Connection pooling, statement timeouts, and role credentials are mandatory before public traffic (, ).
- Application code must never assume public clients can open DB connections.

## Migration triggers

- Introduce a dedicated search cluster only after Postgres FTS/PostGIS proven insufficient under  /  / .
- Split read replicas or regional instances when latency or failover SLOs require it (not a new microservice).
- Engine major upgrades follow Cloud SQL maintenance windows with restore rehearsal ( / ).

## Rollback considerations

- Schema migrations must be expandable/contractible: deploy compatible SQL before incompatible app code (ADR-006).
- Point-in-time recovery and release-manifest restore are the primary data rollback paths, not “drop Cloud SQL.”
- Local Docker volume wipe is acceptable for dev only; never a production rollback strategy.
