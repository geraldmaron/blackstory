<!--
  ADR-026: Supabase PostgREST as the open developer read surface over published-only
  views. Supersedes conflicting ADR-020 / mobile-boundary language that required all
  public reads through Node apps/api-public. Dual-surface with App Check mobile path.
-->

# ADR-026: PostgREST published-read surface

- **Status:** Accepted
- **Date:** 2026-07-21
- **Bead:** repo-2ztn.11 (data-landscape capitalization)
- **Depends on:** ADR-004, ADR-009, ADR-010, ADR-020
- **Amends / partially supersedes:** ADR-020 (§3 “product tables not for Data API / keep reads behind custom API only” as applied to *published* reads); ADR-022 language that treats `apps/api-public` as the *sole* public machine-readable path
- **Does not supersede:** ADR-004 (immutable releases), ADR-009 (research isolation), dignity / living-person rules

## Scaffold vs target

| Aspect | Today (verified) | Target (this decision) |
|--------|------------------|------------------------|
| Open developer reads | Bounded Node `apps/api-public` `/v1/*` | **PostgREST / Supabase Data API** over **narrow published views** |
| Mobile / App Check reads | `apps/api-public` | **Unchanged** — abuse-bounded dual surface |
| Canonical / research / drafts | Closed to `anon` | **Remain closed** |
| Marketing of “Black history API” | Not public | Allowed only after geo-integrity + capture-completeness bars |

## Context

The 2026-07-21 data-landscape brief correctly notes that PostgREST appears “for free” once schema and RLS exist. ADR-020 deliberately kept product tables out of the `public` schema and preferred custom APIs — good for dignity and abuse, but it blocked the empty-quadrant *machine-queryable* axis for open developers.

Owner direction: existing ADRs may be superseded on merits. Live corpus (~1.1k release entities, thin captures, empty claims table at intake) still forbids marketing a confident API before quality gates. This ADR unlocks the **architecture**, not a launch announcement.

Cost envelope: [`docs/research/supabase-pro-cost-envelope.md`](../research/supabase-pro-cost-envelope.md) (Micro only, spend caps, no PITR/branching, egress-aware caching).

## Decision

1. **Published-only PostgREST surface.** Expose `anon` / `authenticated` SELECT **only** through dedicated views (or `bb_public` active-release tables already gated by RLS) that project active-release entities, search index rows, and similarly published artifacts. Status vocabulary for resolvable rows remains `published` | `corrected` | `superseded` | `deprecated` (aligned with fact/entity public resolvability).

2. **Never expose to `anon`:** `bb_canonical` drafts, `bb_research`, `bb_ops` write paths, unpublished candidates, living-person precise coordinates beyond the existing public redaction, or service-role capabilities.

3. **Dual-surface model.**
   - **Open developers:** PostgREST / Data API on published views (API key + RLS; documented rate and fan-out guidance).
   - **Mobile / attested clients:** `apps/api-public` retains App Check, rate-limit classes, and redaction DTOs.
   - Collapse to one surface only with a measured cost/abuse report — not by default.

4. **Publish gate as database invariant.** RLS (and views that join `bb_public.active_release`) remain the fail-closed publish gate. Application bugs must not leak drafts.

5. **Marketing preconditions** (capability bars, not launch theater):
   - Geo-integrity publish gate available and used on new publishes ([`docs/research/geo-integrity-gate.md`](../research/geo-integrity-gate.md)).
   - Capture-completeness ops bar defined and trending toward target ([`docs/research/capture-completeness-ops-bar.md`](../research/capture-completeness-ops-bar.md)).
   - License / attribution / versioning stated before encouraging third-party clients.
   - Public MCP is **out of scope** here; unlock criteria are separate.

6. **Living-person coarsening** stays view/RLS enforced for `anon` (stored precision for research roles only).

7. **Versioning & support.** Breaking view/column changes require a versioned view name or documented deprecation window. Open data is a support obligation; prefer share-alike attribution license language on the methodology/docs surfaces.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Dump `bb_canonical` into Data API | Dignity, draft leakage, abuse enumeration |
| PostgREST only; delete `api-public` now | Loses App Check / mobile abuse controls without a measured replacement |
| Wait for MCP before any query surface | MCP must sit *on* a stable API; reverse order launders errors |
| Market API at current capture/claims depth | Quality-first sequencing from landscape intake |

## Consequences

- New migrations may add `bb_public` or `public`-schema **views** that select only active-release data; never widen `anon` grants on canonical tables.
- Docs and OpenAPI for PostgREST filters (`?state=eq.MA`, embeds) land after views exist.
- ADR-020 remains SoR authority for Postgres/Auth/roles; this ADR only revises the **developer read channel**.
- Operators keep research isolation: research role still cannot activate releases.

## Rollback

- Revoke `anon` grants on published views; leave `api-public` as sole machine path.
- Do not “fix” public truth by editing projections — use release pointer semantics (ADR-004).
