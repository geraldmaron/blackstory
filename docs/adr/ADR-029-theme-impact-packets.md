<!--
  ADR-029: ThemeImpactPacket as the public answer unit for canonical theme-impact
  questions (Q1–Q9). Composes bb_reference stats + evidence/claims; juxtaposition
  default per methodology.
-->

# ADR-029: Theme impact packets

- **Status:** Accepted
- **Date:** 2026-07-22
- **Depends on:** ADR-004, ADR-009, ADR-020, ADR-026; [juxtaposition-not-causation.md](../methodology/juxtaposition-not-causation.md)
- **Design companion:** [`theme-impact-packet-system.md`](../research/theme-impact-packet-system.md)
- **Catalog companion:** [`theme-impact-canonical-questions.md`](../research/theme-impact-canonical-questions.md)

## Scaffold vs target

| Aspect | Today (verified) | Target (this decision) |
|--------|------------------|------------------------|
| Canonical questions | Locked in `theme-impact-questions.ts` + research catalog | Unchanged vocabulary |
| Public answer unit | Ad hoc story blocks / map bindings | **`ThemeImpactPacket`** per question id (`Q1`–`Q9`) |
| Stats base | `bb_reference.statistical_*`, `derived_measurements`, `entity_context_bindings` | Packets **compose refs**; no duplicate observations |
| Evidence / claims | `bb_evidence`, `bb_canonical.claims` | Artifact + gated-causal refs in packet JSON |
| Surfaces | Stories, map panels (partial) | **Same packet** on `/themes`, story embeds, map context panels |
| Method stance | Methodology doc only | **`juxtaposition` default**; `gated_causal_claim` only with claim ids clearing confidence gate |
| Publication | ADR-004 release projections | Published packets in **active-release** projection only; drafts closed (RLS) |
| Pilot | Not shipped | **One metro × `redlining`** (`Q1`–`Q4`) |

## Context

Survey and catalog work locked ten canonical theme-impact questions, policy eras, and metric
bindings. Operators need a single composable artifact that answers a question on every public
surface without re-authoring numbers, without auto-inferring causation, and without bypassing
ADR-004 immutable releases or ADR-009 research isolation.

Story packets and `entity_context_bindings` already juxtapose law/place entities with
indicators. Theme-impact packets generalize that pattern into a **reusable product unit** tied
to question ids, not one-off narrative blocks.

## Decision

1. **`ThemeImpactPacket` is the unit of a public answer** to a canonical theme-impact question
   (`Q1`–`Q9`). `Q10` remains a methodology gate (copy/policy), not a stored packet shape.
   Question ids, themes, answer shapes, and metric bindings are authoritative in
   `packages/domain/src/statistics/theme-impact-questions.ts` and
   [`theme-impact-canonical-questions.md`](../research/theme-impact-canonical-questions.md).

2. **Shared evidence / stats base.** Observations live in `bb_reference.statistical_observations`;
   artifacts and heritage claims live in `bb_evidence` / `bb_canonical.claims`. A packet **does
   not duplicate** estimate rows — it stores stable refs (`observation_id`, `derived_id`,
   `claim_id`, `source_item_id`, …) plus presentation metadata (era roll-up, role labels).
   Metric definitions remain in `bb_reference.statistical_series` (Phase 1 catalog seeds
   definitions; loaders populate observations).

3. **One packet, three surfaces.** The same published packet projects to:
   - **`/themes` browse** — theme hub and question cards
   - **Story embeds** — inline chart / timeline / narrative blocks
   - **Map context panels** — jurisdiction- or entity-scoped slices  
   Surface-specific chrome (layout, truncation) may differ; **numbers, citations, gap labels,
   and method stance must not**.

4. **Method stance.** Default `method_stance: 'juxtaposition'`. Set
   `method_stance: 'gated_causal_claim'` only when the packet includes one or more **heritage
   claim ids** that have cleared the claim confidence gate (peer-reviewed or equivalent per
   constitution). Co-moving indicators or derived deltas **never** auto-elevate to causal
   language. See [juxtaposition-not-causation.md](../methodology/juxtaposition-not-causation.md).

5. **Provenance on public numbers.** Every published statistic shown through a packet carries
   the provenance quartet (`source`, `source_url`, `retrieved_at`, `content_hash`) plus a
   **human citation** string suitable for educators and journalists. Derived and modeled values
   additionally expose formula / method id and input observation ids.

6. **Gap states are visible.** Packets must surface `insufficient_evidence` when a question
   cannot be answered at declared geography/era depth, and **`modeled`** when any composed
   derived row has `status: 'modeled'`. UI copy must not collapse gaps into silence or imply
   completeness.

7. **Entity context bindings.** Entity-bound views (especially `Q4` place narrative and map
   panels) reference `bb_reference.entity_context_bindings` (`purpose`: `map_panel` |
   `story` | `research`). **Standalone theme pages** (`/themes/{theme}`) are valid **without**
   a single heritage entity; bindings are optional enrichments, not a hard requirement for
   every packet.

8. **Published packets only on public surfaces.** Draft packets live in canonical / research
   lanes with research+staff RLS. Public web, PostgREST published views (ADR-026), and
   `apps/api-public` read **active-release projections** only. Preview → promote follows
   ADR-004; no in-place edits to active packets.

9. **Out of scope (this ADR).**
   - Automated causal impact inference from correlated series
   - Public MCP exposure of theme packets (operator MCP may read drafts under existing roles)
   - Live ingestion approval or registry `enabled` flips (separate ingestion beads)
   - Replacing heritage entity pages or story packet review workflows

10. **Next step.** Execute **one metro × `redlining` pilot** covering `Q1`–`Q4` end-to-end
    (authoring → release projection → `/themes`, one story embed, one map panel) before
    expanding to `drug_policy_state` or P1 themes.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Embed stats only in story MDX / CMS fields | Duplicates provenance; breaks `/themes` + map parity |
| New “impact claim” type auto-built from deltas | Violates juxtaposition methodology; dignity risk |
| Public read of canonical packet drafts via API key | Draft leakage; conflicts ADR-004 / ADR-009 |
| Per-surface packet variants with different numbers | Audit and trust failure; one composable unit required |
| Store full observation payloads inside packet JSONB | Drifts from `bb_reference`; hash/provenance divergence |

## Consequences

- **v1 scaffold (shipped):** `supabase/migrations/20260722160000_theme_impact_packets.sql`
  creates `bb_reference.theme_impact_packets` with `status` (`draft` | `review` | `published`),
  JSONB observation/derived/artifact payloads, and RLS (anon/authenticated SELECT only when
  `published`; staff SELECT all). Suitable for fixture pilots and `/themes` before a full
  release-projection worker exists.
- **Target (ADR-004):** promote into `bb_canonical.theme_impact_packets` (draft authoring) +
  `bb_public.release_theme_impact_packets` (immutable projection) per
  [`theme-impact-packet-system.md`](../research/theme-impact-packet-system.md) when the redlining
  pilot enters formal release activation — do not treat the v1 table as the long-term publish SoT.
- `@repo/domain` exports `ThemeImpactPacket` (`theme.impact.packet.v1`) with
  `buildThemeImpactPacket` / `assertThemeImpactPacketPublishable` in
  `packages/domain/src/statistics/theme-impact-packet.ts`.
- Story templates and map panels consume a shared DTO; juxtaposition disclaimer copy is
  mandatory when bindings or era-aligned indicators are shown.
- PostgREST views may expose **published** theme packets only after geo-integrity and capture
  bars for the pilot metro are met (ADR-026 marketing preconditions unchanged).

## Related decisions

- **ADR-004** — immutable release pointer; packet rollback = activate prior release.
- **ADR-009** — research authors drafts; cannot activate releases.
- **ADR-020** — Postgres SoR; private `bb_*` schemas.
- **ADR-026** — published read surface; theme packets follow published-only views when exposed
  to open developers.
