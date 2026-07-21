# ADR-020: Supabase Postgres as system of record

- **Status:** Accepted
- **Date:** 2026-07-20
- **Bead:** repo-ivh4
- **Depends on:** ADR-004, ADR-005, ADR-009, ADR-010, ADR-015, ADR-016
- **Supersedes (production SoR path):** ADR-011
- **Amends:** ADR-002 / ADR-003 (Cloud SQL + SQL Connect remain non-path); ADR-008 / ADR-014 (geo/search/vectors land in Postgres)
- **Does not supersede:** ADR-004 (immutable public projections), ADR-012 (multi-project ops topology for Firebase remains until cutover)

## Scaffold vs target

| Aspect | Today (verified) | Target (this phase) |
|--------|------------------|---------------------|
| System of record | Cloud Firestore (`black-book-efaaf`) | Supabase Postgres project **`blackstory-app`** (`twykhihqkcldpreuovay`, `us-west-2`) |
| Auth | Firebase Auth + custom claims | **Supabase Auth**; roles in `app_metadata.bb_role` only |
| Blobs | Firebase Storage / GCS | Unchanged for this phase (metadata refs in Postgres) |
| Schema docs / DDL | Parked Cloud SQL stubs under `infra/database/` | Versioned DDL under `supabase/migrations/` |
| ETL / cutover | N/A | **Out of scope** for this ADR (follow-up) |

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
8. **Blobs** remain in Firebase Storage / GCS for this phase; Postgres stores object refs only.
9. **Firestore remains live** until a separate cutover ADR/plan. This ADR authorizes schema design + DDL landing in-repo and (when explicitly approved) on `blackstory-app`. It does **not** authorize dual-write or production traffic cutover.
10. Parked Cloud SQL / SQL Connect under `infra/database/` stays non-production; banners point here.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Keep Firestore SoR indefinitely | Owner direction is Postgres on Supabase; geo/search/txn integrity better fit |
| Provision Cloud SQL instead of Supabase | Owner selected connected project `blackstory-app` |
| Dump tables into `public` schema | Over-exposes Data API surface; contradicts boundary model |
| Authorize via `user_metadata` | User-editable; unsafe for RLS |
| Force UUID PKs on all tables | Breaks semantic IDs and migration fidelity |
| Move blobs into Supabase Storage now | Out of scope; increases cutover risk |

## Consequences

- New schema work lands under `supabase/` and `docs/data/postgres-schema.md`.
- ADR-011 is historical for the Firestore phase; do not start new SoR features assuming Firestore permanence.
- App rewire, ETL, and dual-run require follow-up beads after DDL review/apply.
- CI may add optional Supabase migration checks later; do not block existing Firestore emulator CI until cutover.
- Operators must be provisioned in Supabase Auth with `app_metadata.bb_role` before admin RLS paths work.

## Rollback

- DDL on empty `blackstory-app` can be dropped/reset if unused.
- Production traffic remains on Firestore until cutover; rolling back this ADR means pausing further Supabase schema expansion, not undoing Firestore.
- Never “fix” public truth by editing active projections — use ADR-004 release pointer semantics in Postgres as in Firestore.
