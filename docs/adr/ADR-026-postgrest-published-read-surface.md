<!--
  ADR-026: Supabase PostgREST as the open developer read surface over published-only
  views. Dual-surface with apps/api-public for attested mobile/abuse-bounded clients.
-->

# ADR-026: PostgREST published-read surface

- **Status:** Accepted (amended 2026-07-22: attestation wording)
- **Date:** 2026-07-21
- **Depends on:** ADR-004, ADR-009, ADR-010, ADR-020
- **Amends / partially supersedes:** ADR-020 (§3 “product tables not for Data API / keep reads behind custom API only” as applied to *published* reads); ADR-022 language that treats `apps/api-public` as the *sole* public machine-readable path
- **Does not supersede:** ADR-004 (immutable releases), ADR-009 (research isolation), dignity / living-person rules

## Scaffold vs target

| Aspect | Today (verified) | Target (this decision) |
|--------|------------------|------------------------|
| Open developer reads | Bounded Node `apps/api-public` `/v1/*` | **PostgREST / Supabase Data API** over **narrow published views** |
| Mobile / attested reads | `apps/api-public` | **Unchanged** — abuse-bounded dual surface (client headers / request integrity) |
| Canonical / research / drafts | Closed to `anon` | **Remain closed** |
| Marketing of “Black history API” | Not public | Allowed only after geo-integrity + capture-completeness bars |

## Context

PostgREST appears once schema and RLS exist. ADR-020 deliberately kept product tables out of
the `public` schema and preferred custom APIs — good for dignity and abuse, but it blocked the
empty-quadrant *machine-queryable* axis for open developers.

Owner direction: existing ADRs may be superseded on merits. Live corpus still forbids marketing
a confident API before quality gates. This ADR unlocks the **architecture**, not a launch
announcement.

Cost envelope: [`docs/research/supabase-pro-cost-envelope.md`](../research/supabase-pro-cost-envelope.md).

## Decision

1. **Published-only PostgREST surface.** Expose `anon` / `authenticated` SELECT **only** through
   dedicated views (or `bb_public` active-release tables already gated by RLS) that project
   active-release entities, search index rows, and similarly published artifacts.

2. **Never expose to `anon`:** `bb_canonical` drafts, `bb_research`, `bb_ops` write paths,
   unpublished candidates, living-person precise coordinates beyond the existing public
   redaction, or service-role capabilities.

3. **Dual-surface model.**
   - **Open developers:** PostgREST / Data API on published views (API key + RLS; documented
     rate and fan-out guidance).
   - **Mobile / attested clients:** `apps/api-public` retains rate-limit classes, redaction DTOs,
     and client attestation / request-integrity controls (not Firebase App Check).
   - Collapse to one surface only with a measured cost/abuse report — not by default.

4. **Publish gate as database invariant.** RLS (and views that join `bb_public.active_release`)
   remain the fail-closed publish gate.

5. **Marketing preconditions** (capability bars, not launch theater): geo-integrity gate,
   capture-completeness ops bar, license/attribution/versioning, before encouraging third-party
   clients. Public MCP is out of scope here.

6. **Living-person coarsening** stays view/RLS enforced for `anon`.

7. **Versioning & support.** Breaking view/column changes require a versioned view name or
   documented deprecation window.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Dump `bb_canonical` into Data API | Dignity, draft leakage, abuse enumeration |
| PostgREST only; delete `api-public` now | Loses mobile abuse controls without a measured replacement |
| Wait for MCP before any query surface | MCP must sit on a stable API |
| Market API at current capture/claims depth | Quality-first sequencing |

## Consequences

- New migrations may add `bb_public` or `public`-schema **views** that select only active-release
  data; never widen `anon` grants on canonical tables.
- ADR-020 remains SoR authority for Postgres/Auth/roles; this ADR only revises the **developer
  read channel**.
- Operators keep research isolation: research role still cannot activate releases.
