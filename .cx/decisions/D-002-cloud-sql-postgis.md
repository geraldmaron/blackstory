# D-002 — Cloud SQL PostgreSQL + PostGIS (superseded)

**Status:** Superseded for current phase by [D-014](./D-014-firestore-not-cloud-sql.md) / [ADR-011](../../docs/adr/ADR-011-firestore-system-of-record.md).

Former intent: Cloud SQL PostgreSQL + PostGIS as system of record; local PostGIS compose.  
Now: Firestore is system of record; `infra/database/` parked; do not provision Cloud SQL.

Formal historical text: `docs/adr/ADR-002-cloud-sql-postgresql-postgis.md`
