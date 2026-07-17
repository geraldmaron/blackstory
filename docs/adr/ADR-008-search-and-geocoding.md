# ADR-008: Search and geocoding

- **Status:** Accepted (amended by [ADR-011](./ADR-011-firestore-system-of-record.md))
- **Date:** 2026-07-16
- **Bead:** BB-002
- **Depends on:** ADR-004, ADR-005, ADR-011
- **Implements toward:** BB-026, BB-049, BB-050

## Scaffold vs target

| Aspect | Today (verified) | Target (current phase) |
|--------|------------------|------------------------|
| Search API | Not implemented (`api-public` health stub) | Bounded queries over **released Firestore public projections** (prefix/field filters; optional later search engine) |
| Geography | Not implemented | **Geohash** (+ lat/lng) on projection docs; server radius filter in `api-public` |
| Geocoder | Not implemented | U.S. Census Geocoder adapter + cache (BB-050) |
| PostGIS / Postgres FTS | Parked under `infra/database/` | Deferred unless ADR-011 migration triggers fire |
| Separate search SaaS | None | Explicitly deferred until Firestore + geohash proven insufficient |

## Context

Users discover history by place, name, and proximity. Search and geocoding are expensive abuse magnets. Living residential addresses must never be stored or returned as ordinary person-location fields. Product scope for address discovery is U.S.-oriented (50 states + D.C. per BB-050). Ranking should favor relevance and connection strength, not fame alone.

## Decision

1. **Search** is served only by **`apps/api-public`** against **released public projections** (and release-scoped search index metadata), never canonical draft data.
2. **Initial store:** Firestore public projection documents with searchable fields and **geohash** geography — not PostGIS (ADR-011). Prefer in-product bounded queries before a separate search platform.
3. Enforce **approved query shapes only**: min/max length, normalized Unicode, max filters/radius/date range/page size/depth, **cursor pagination**, query timeouts/budgets, no user-defined sort expressions/field selection (BB-026).
4. **Geocoding** uses a **U.S. Census Geocoder** adapter with **normalization**, **geocode cache**, rate limits, and **manual place search fallback** on failure (BB-050).
5. Browser location requires **explicit user action**; no persistent precise-location history; coarse analytics only; reduce exact coordinates when no longer needed.
6. Layered abuse controls (Armor, App Check, quotas) apply more strictly to search/geocode/nearby than to static entity reads (BB-025).
7. Search-index version is tied to each **immutable release** (ADR-004).

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Managed search platform from day one | Extra cost/abuse surface before measuring Firestore + geohash limits. |
| Cloud SQL / PostGIS for search from day one | Deferred by ADR-011 for cost; revisit only on measured triggers. |
| Client-side geocoding with third-party keys in the browser | Key theft and quota bypass; server-side cache/limits required. |
| Storing raw user address history by default | Privacy and living-person risk. |
| Search microservice separate from `api-public` | Over-decomposition; same security domain as public read API. |
| Ranking solely by popularity/fame | Conflicts with product discovery goals for sparse/local records. |

## Consequences

- Public schema and projection design must include searchable/geospatial fields up front (BB-014, BB-019).
- Census Geocoder outages degrade to manual place search, not empty hard-fail of the whole site.
- Load and abuse tests must specifically target search/geocode (BB-059).
- Map-centric UX (BB-051) remains deferred and must reuse the same API guardrails.

## Migration triggers

- Adopt an external search engine only after measured query latency/relevance failure under production-like load **and** guardrails ported.
- Reconsider PostGIS only under [ADR-011](./ADR-011-firestore-system-of-record.md) migration triggers (not preference).
- Add non-U.S. geocoders only with explicit product-scope expansion and privacy review.
- Change geocoder vendor if Census API becomes unsuitable; keep cache and normalization contracts stable.

## Rollback considerations

- Kill-switch search and/or geocoding independently (BB-035) while entity pages continue from snapshots.
- Pin public API to prior release’s search-index version when a bad index ships.
- Flush geocode cache entries that violate privacy rules without rolling back releases.
