<!--
  PostgREST published-read surface: stable public views over active-release
  projections (ADR-026). Documents URL patterns, apply steps, marketing gates,
  and egress guidance. Does not authorize live remote apply without approval.
-->

# PostgREST published views

**Status:** Migration authored (remote apply gated)  
**ADR:** [ADR-026](../adr/ADR-026-postgrest-published-read-surface.md)  
**Migration:** [`supabase/migrations/20260721180000_postgrest_published_views.sql`](../../supabase/migrations/20260721180000_postgrest_published_views.sql)  
**Bead:** repo-651l.3 (data-landscape capitalization)

Supabase exposes the Data API (PostgREST) for schemas listed in [`supabase/config.toml`](../../supabase/config.toml) (`public`, `bb_public`, `bb_submissions`). Product tables remain in private `bb_*` schemas; **open developer reads** use narrow **`public` views** that project only the active release. Mobile and App Check clients continue to use [`apps/api-public`](../../apps/api-public/) (dual-surface model).

## Views

| View | Source table | Scope |
|------|--------------|-------|
| `public.published_entities` | `bb_public.release_entities` | Rows where `release_id` matches `bb_public.active_release` (`id = 'active'`) |
| `public.published_search_index` | `bb_public.search_index` | Same active-release filter |

Both views use `WITH (security_invoker = true)` so existing RLS on `bb_public` tables ([`20260720220010_rls_policies.sql`](../../supabase/migrations/20260720220010_rls_policies.sql)) still applies. The view `WHERE` clause is defense-in-depth; it does **not** widen access beyond the active-release policies already granted to `anon` / `authenticated`.

**Not exposed:** `bb_canonical`, `bb_research`, drafts, unpublished candidates, `bb_ops` write paths, or service-role capabilities.

## URL patterns (Supabase Data API)

**Project:** `blackstory-app` (`twykhihqkcldpreuovay`, `us-west-2`)  
**Base URL:** `https://twykhihqkcldpreuovay.supabase.co/rest/v1/`

Required headers for anonymous reads:

| Header | Value |
|--------|--------|
| `apikey` | Supabase anon (publishable) key |
| `Authorization` | `Bearer <same anon key>` |

### List entities (paginated)

```http
GET /rest/v1/published_entities?select=entity_id,display_name,kind,lat,lng&kind=eq.place&limit=50&order=display_name.asc
```

### Entity detail

```http
GET /rest/v1/published_entities?entity_id=eq.<id>&select=entity_id,display_name,kind,summary,location,projection
```

### Search index (name filter)

```http
GET /rest/v1/published_search_index?select=id,entity_id,name,kind,status&name_lower=ilike.*<term>*&limit=25
```

### Topic facet (array contains)

```http
GET /rest/v1/published_search_index?topics=cs.{<topic>}&select=entity_id,name,topics,facets
```

PostgREST filter operators follow [Supabase REST docs](https://supabase.com/docs/guides/api). Prefer explicit `select=` column lists over `select=*` to limit payload size.

**Status vocabulary** for resolvable public rows: `published` | `corrected` | `superseded` | `deprecated` (see ADR-026). Filter on `published_search_index.status` when needed.

## RLS and access model

| Role | `published_*` views | `bb_canonical` / `bb_research` |
|------|---------------------|--------------------------------|
| `anon` | SELECT (active release only) | No access |
| `authenticated` | SELECT (active release only) | Staff roles only via separate policies |
| `service_role` | Bypasses RLS (server-side only) | Full write/read per grants |

Research roles **cannot** activate releases; the publish gate stays a database invariant (ADR-004, ADR-009).

## Marketing and quality gates

Architecture is unlocked; **marketing a “Black history API” is not**. Preconditions from ADR-026:

- [Geo-integrity publish gate](../research/geo-integrity-gate.md) available and used on new publishes
- [Capture-completeness ops bar](../research/capture-completeness-ops-bar.md) defined and trending toward target
- License, attribution, and versioning stated before encouraging third-party clients

Public MCP unlock criteria are separate ([`public-mcp-unlock-criteria.md`](../research/public-mcp-unlock-criteria.md)).

## Cost and fan-out guidance

PostgREST egress is the primary cost risk once integrators scale. See **[Supabase Pro cost envelope](../research/supabase-pro-cost-envelope.md)** (§5 — published-view PostgREST):

- Prefer **release-versioned static exports** (CDN) for bulk or product-scale traffic
- Avoid unbounded pagination, N+1 detail fetches, polling, and `select=*` on wide rows
- Use column selection, capped page sizes, and caching where PostgREST is required
- Dual surface: mobile → `api-public`; open developers → PostgREST or cached artifacts

## Apply steps (not live by default)

Per [`supabase/README.md`](../../supabase/README.md), **do not apply to remote production without explicit owner approval**.

### Local validation

```bash
cd /path/to/blackstory-mobile
supabase start          # if local stack not running
supabase db reset       # replays all migrations including 20260721180000
```

Verify views:

```sql
SELECT count(*) FROM public.published_entities;
SELECT count(*) FROM public.published_search_index;
-- Counts should match active-release rows in bb_public.* (RLS-aware as current role).
```

Optional smoke test against local REST (anon key from `supabase status`):

```bash
curl -s \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  "http://127.0.0.1:54321/rest/v1/published_entities?select=entity_id&limit=1"
```

### Remote apply (human gate)

1. Review migration in PR
2. `supabase link --project-ref twykhihqkcldpreuovay` (once)
3. `SUPABASE_ACCESS_TOKEN` from 1Password (`op://Private/Supabase/credential`)
4. `supabase db push` **or** paste migration into Dashboard → SQL Editor after approval
5. Confirm views in Dashboard (schema `public`) and spot-check counts vs `bb_public.release_entities`

Rollback: `REVOKE SELECT ON public.published_entities, public.published_search_index FROM anon, authenticated;` then `DROP VIEW` if removing the surface entirely (ADR-026 rollback).

## References

- [ADR-026 PostgREST published-read surface](../adr/ADR-026-postgrest-published-read-surface.md)
- [Postgres schema](./postgres-schema.md)
- [Supabase Pro cost envelope](../research/supabase-pro-cost-envelope.md)
- [Rate limits](../security/rate-limits.md)
