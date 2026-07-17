# D-008 — Search and geocoding

Search/nearby via `api-public` against **released public projections** only.  
**Current phase (ADR-011):** Firestore field/prefix queries + **geohash** geography; Census Geocoder + cache (BB-050).  
PostGIS / Postgres FTS deferred unless ADR-011 migration triggers fire. Dedicated search SaaS still deferred until measured need.

Formal: `docs/adr/ADR-008-search-and-geocoding.md`
