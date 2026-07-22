<!--
  Methodology: juxtaposition of law/policy entities with place-time indicators is not
  automated causal inference. Binds research UI and MCP language.
-->

# Juxtaposition is not causation

**Status:** Binding product methodology  
**Date:** 2026-07-21  
**Related:** [context-data-source-matrix.md](../research/context-data-source-matrix.md), [confidence-lineage.md](../research/confidence-lineage.md), constitution `policy.v1.json`, `bb_reference.entity_context_bindings`

## Problem

Users (and MCP clients) will ask: *What was the impact of this law on Black communities here?* Academic-grade answers require evidence. Automated pipelines that emit “Policy Z caused incarceration to rise X%” invent causation BlackStory must not publish.

## Allowed product shapes

| Shape | Where it lives | Allowed language |
|-------|----------------|------------------|
| Law / case **entity** with evidenced claims | Heritage lane → release entities | “Enacted”, “overturned”, “challenged” — constitution legal vocabulary |
| Place-time **indicator** | `StatisticalObservation` | “In year Y, the published imprisonment rate for Black residents in state S was R (source…)” |
| **Derived** ratio / gap | `DerivedMeasurement` with `status: 'derived' \| 'modeled'` | “Black–White imprisonment rate ratio was V in year Y” — formula + input observation ids required |
| **Juxtaposition** binding | `entity_context_bindings` + story / research packet | “This law entity is shown beside these indicators for the same jurisdiction and era — for context, not as proof of effect” |
| Causal claim | Only as a heritage **claim** with peer-reviewed (or equivalent) citation | Must clear claim confidence gate; never auto-generated from indicator deltas |

## Forbidden

- Auto-promoting “impact” claims from co-moving time series
- Map heat of crime or incarceration as spectacle
- Presenting modeled Opportunity Atlas cohort outcomes as jurisdiction imprisonment rates
- Omitting provenance quartet on any published statistic
- Binding an entity to an indicator without matching geography vintage / `boundary_version` (or an explicit crosswalk step)

## `entity_context_bindings`

Postgres table `bb_reference.entity_context_bindings` (see migration `statistical_series_observations`):

| Column | Role |
|--------|------|
| `entity_id` | Canonical / release entity id (law, place, movement, …) |
| `metric_id` | `StatisticalSeries.metric_id` |
| `purpose` | `map_panel` \| `story` \| `mcp` \| `research` |
| `jurisdiction_id` | Optional override; else resolve from entity location → jurisdiction |
| `notes` | Human rationale for the binding (not a causal claim) |

Bindings are **curatorial**. Research cases and story packets remain the place for narrative synthesis that cites both the law and the indicators.

## UI / MCP copy requirements

When surfacing a binding, include a fixed disclaimer pattern:

> Context indicators are published measurements from named custodians. Showing them with a law or place does not establish that the law caused the indicator values. Causal statements require separately evidenced claims.

Operator MCP tools (`get_entity_context`) must return this disclaimer field on every juxtaposition payload.

## Implementation checklist

- [x] Source matrix documents store vs cite for justice/wealth sources  
- [x] Registry entries for BJS / Vera / SCF / SIPP / voting (disabled)  
- [x] Normalized `statistical_*` tables + `entity_context_bindings`  
- [ ] Phase 1 loaders populate observations with provenance  
- [ ] Story templates require indicator + law citations when discussing “impact”  
- [ ] Public MCP deferred until unlock criteria  
