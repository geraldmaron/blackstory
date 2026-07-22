# ADR-020: Supabase Postgres as system of record

- **Status:** Accepted (amended 2026-07-21 Storage; reconciled 2026-07-22 cutover language)
- **Date:** 2026-07-20
- **Depends on:** ADR-004, ADR-005, ADR-009, ADR-010, ADR-015, ADR-016
- **Supersedes (production SoR path):** ADR-011
- **Amends:** ADR-002 / ADR-003 (Cloud SQL + SQL Connect remain non-path); ADR-008 / ADR-014 (geo/search/vectors land in Postgres)
- **Does not supersede:** ADR-004 (immutable public projections). ADR-012 (multi-project Firebase ops topology) remains a separate, not-yet-applied ops decision; Firebase wind-down may leave a single project until the owner checklist completes.

## Scaffold vs target

| Aspect | Today (verified) | Target (this phase) |
|--------|------------------|---------------------|
| System of record | **Supabase Postgres** (`blackstory-app`) for migrated product tables | Same; expand schema under `supabase/migrations/` |
| Auth | **Supabase Auth**; roles in `app_metadata.bb_role` (admin) | Same; Firebase Auth only as documented rollback |
| Blobs | **Supabase Storage** primary for `public-media`; GCS dual-serve / rollback | Complete raw-sources + wind-down |
| Schema docs / DDL | `supabase/migrations/`, `docs/data/postgres-schema.md` | Same |
| Firestore | Export / rollback / utilities only | Owner wind-down checklist |

## Context

ADR-011 deferred Cloud SQL for cost while Firestore held structured product data. The product now targets Supabase Postgres on the existing empty project **blackstory-app** (Auth schema only; zero product migrations at decision time). Browser OAuth for MCP was unreliable; PAT-backed admin access is operational. Live Firestore has ops/stats/release seed data but many typed canonical collections are still empty — the Postgres schema must encode the **full product model**, not only nonempty live collections.

Non-negotiable invariants from prior ADRs still bind: no anonymous canonical writes; public reads of released projections only; submissions require promotion; research cannot publish; living-person and evidence provenance rules remain binding; release activation is pointer-swap over immutable artifacts (ADR-004).

## Decision

1. **Supabase Postgres on `blackstory-app`** is the intended system of record for structured entities, claims, evidence **metadata**, sources, publication releases, public projections, submissions, audit, policy, ops documents, and reference statistics.
2. **Supabase Auth** replaces Firebase Auth for operators and authenticated clients. Authorization roles (`admin` \| `research` \| `publication` \| `security`) live exclusively in **`app_metadata.bb_role`**. Never authorize from `user_metadata`.
3. **Logical schemas** use private `bb_*` namespaces (`bb_public`, `bb_submissions`, `bb_research`, `bb_evidence`, `bb_canonical`, `bb_publication`, `bb_reference`, `bb_ops`, `bb_audit`, `bb_auth`). Product tables are **not** placed in `public` for Data API exposure by default.
4. **RLS** is enabled on every grantable application table. Public `anon`/`authenticated` SELECT is limited to active-release surfaces in `bb_public`. Canonical / evidence / publication **writes** are `service_role` (and named `SECURITY DEFINER` RPCs such as release activation), not broad `authenticated` policies.
5. **Research cannot publish** — no grant or RLS path for `bb_role=research` to mutate `bb_public.active_release` or activate releases.
6. **Natural text keys** are preserved for semantic document IDs (`us-06-001`, `{fips5}_{decade}`, etc.). UUIDs are used where the domain already used random IDs.
7. **Geography / vectors** use PostGIS (`geography(Point,4326)`) and `pgvector` (`vector(768)`), retaining geohash text for transition compatibility.
8. **Blobs** live in **Supabase Storage** for product public-media (and phased raw-sources). Postgres stores object refs / public URLs only. GCS / Firebase Storage remains a dual-serve rollback origin until the owner completes wind-down; agents never delete GCS objects as part of cutover.
9. **Structured cutover is done** for migrated product tables: treat Postgres as SoR; **do not dual-write** new canonical truth to Firestore. Firestore remains available for **export and rollback** until `docs/data/firebase-wind-down.md` completes. This ADR does **not** authorize irreversible Firebase project deletion.
10. Parked Cloud SQL / SQL Connect under `infra/database/` stays non-production; banners point here.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Keep Firestore SoR indefinitely | Owner direction is Postgres on Supabase; geo/search/txn integrity better fit |
| Provision Cloud SQL instead of Supabase | Owner selected connected project `blackstory-app` |
| Dump tables into `public` schema | Over-exposes Data API surface; contradicts boundary model |
| Authorize via `user_metadata` | User-editable; unsafe for RLS |
| Force UUID PKs on all tables | Breaks semantic IDs and migration fidelity |
| Keep blobs on GCS indefinitely | Rejected for Firebase wind-down; Supabase Storage is preferred for public-media with dual-serve cutover |
| Big-bang delete of GCS during first copy | Unsafe; dual-serve + soak required |

## Consequences

- New schema work lands under `supabase/` and `docs/data/postgres-schema.md`.
- ADR-011 is historical for the Firestore phase; do not start new SoR features assuming Firestore permanence.
- **Cutover (2026-07-21):** Structured product data is migrated into `blackstory-app`. Public web supports `PUBLIC_DATA_SOURCE=postgres` (server-only `DATABASE_URL` / `APP_DATABASE_URL`; never `NEXT_PUBLIC_*`). Treat Postgres as SoR for migrated tables; do not dual-write new canonical truth to Firestore.
- **Blob cutover (2026-07-21+):** Public-media objects move to Supabase Storage buckets (`public-media`, later `raw-sources`) with dual-serve against GCS until verified. Egress for Storage shares the Pro envelope with PostgREST — prefer CDN-cached public URLs; monitor Scenario C in `docs/research/supabase-pro-cost-envelope.md`. New writes target Supabase; GCS is not deleted by agents.
- Auth: operators provisioned in Supabase Auth with `app_metadata.bb_role`; admin UI may still accept Firebase session until auth cutover bead closes. Public remains anon + RLS on `bb_public`.
- Firebase wind-down is **owner console checklist** (`docs/data/firebase-wind-down.md`): stop app use, tighten rules, export, pause/archive — **never** irreversible project delete without dual verification.
- CI may add optional Supabase migration checks later; do not block existing Firestore emulator CI until Firebase is fully retired.
- Operators must be provisioned in Supabase Auth with `app_metadata.bb_role` before admin RLS paths work.

## Rollback

- Prefer ADR-004 release pointer rollback in Postgres over editing live projections.
- Temporary `PUBLIC_DATA_SOURCE=firestore` (or equivalent) is an explicit opt-in during wind-down only, not a silent default.
- Never delete the Firebase project without dual verification and completed export checklist.
- DDL mistakes on `blackstory-app` use migrations and release discipline, not dual-write back to Firestore as a habit.
