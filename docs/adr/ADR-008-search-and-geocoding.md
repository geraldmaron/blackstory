# ADR-008: Search and geocoding

- **Status:** Accepted (amended by [ADR-020](./ADR-020-supabase-postgres-system-of-record.md))
- **Date:** 2026-07-16
- **Amended:** 2026-07-22
- **Depends on:** ADR-004, ADR-005, ADR-020

## Scaffold vs target

| Aspect | Today (verified) | Target |
|--------|------------------|--------|
| Search API | `apps/api-public` (+ PostgREST published reads, ADR-026) | Bounded queries over **released public projections** in Postgres |
| Geography | PostGIS points + transitional geohash text | **PostGIS** (`geography(Point,4326)`); geohash optional for compat |
| Geocoder | U.S. Census Geocoder adapter + cache | Same |
| Full-text | Postgres FTS / `pg_trgm` as needed | Prefer in-DB before external search SaaS |
| Separate search SaaS | None | Deferred until measured need |

## Context

Users discover history by place, name, and proximity. Search and geocoding are expensive
abuse magnets. Living residential addresses must never be stored or returned as ordinary
person-location fields. Ranking should favor relevance and connection strength, not fame alone.

ADR-011 originally routed search/geo through Firestore + geohash. ADR-020 moved the product
SoR to Supabase Postgres; this ADR follows that store.

## Decision

1. **Search** is served by **`apps/api-public`** (and, for open published reads, PostgREST
   views per ADR-026) against **released public projections**, never canonical draft data.
2. **Store:** Postgres on `blackstory-app` with **PostGIS** for geography and PostgreSQL
   FTS/`pg_trgm` for text. Geohash text may remain for transition compatibility only.
3. Enforce **approved query shapes only**: min/max length, normalized Unicode, max
   filters/radius/date range/page size/depth, **cursor pagination**, query timeouts/budgets,
   no user-defined sort expressions/field selection.
4. **Geocoding** uses a **U.S. Census Geocoder** adapter with **normalization**, **geocode
   cache**, rate limits, and **manual place search fallback** on failure.
5. Browser location requires **explicit user action**; no persistent precise-location history;
   coarse analytics only; reduce exact coordinates when no longer needed.
6. Layered abuse controls (edge WAF when applied, request integrity / client attestation,
   quotas) apply more strictly to search/geocode/nearby than to static entity reads.
7. Search-index version is tied to each **immutable release** (ADR-004).

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Managed search platform from day one | Extra cost/abuse surface before measuring Postgres limits |
| Keep Firestore + geohash as primary search store | Superseded by ADR-020 SoR cutover |
| Client-side geocoding with third-party keys in the browser | Key theft and quota bypass |
| Storing raw user address history by default | Privacy and living-person risk |
| Search microservice separate from `api-public` | Over-decomposition; same security domain as public read API |
| Ranking solely by popularity/fame | Conflicts with discovery goals for sparse/local records |

## Consequences

- Public schema and projection design must include searchable/geospatial fields in Postgres.
- Census Geocoder outages degrade to manual place search, not empty hard-fail of the whole site.
- Load and abuse tests must specifically target search/geocode.

## Migration triggers

- Adopt an external search engine only after measured query latency/relevance failure under
  production-like load **and** guardrails ported.
- Add non-U.S. geocoders only with explicit product-scope expansion and privacy review.

## Rollback considerations

- Kill-switch search and/or geocoding independently while entity pages continue from snapshots.
- Pin public API to prior release’s search-index version when a bad index ships.
- Flush geocode cache entries that violate privacy rules without rolling back releases.
