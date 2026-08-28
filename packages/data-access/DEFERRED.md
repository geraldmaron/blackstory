# Deferred: Cloud SQL / SQL Connect / parked PostGIS (historical ADR-011)

> **Leftover package note.** Current production path (2026-08-28): Supabase Postgres on
> `blackstory-app` via `@repo/data-access` Postgres modules. Firestore is not the SoR.

This package historically hosted Cloud SQL / SQL Connect helpers.

Firestore converters under `src/firestore/` and `@repo/firebase` are leftover. Do not treat
them as the production read path.

Parked Cloud SQL / SQL Connect modules remain exported for optional local experiments. They
are **not** the product system of record. Do not provision Cloud SQL.
