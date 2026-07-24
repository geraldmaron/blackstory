# Geographic Gap Scanner

Research-discovery methodology (`geographic-gap.v1`): systematically find counties where
published Black-history coverage is thin **relative to documented Black population**, then
launch targeted discovery there. This operationalizes the
[empty-quadrant vision](../methodology/empty-quadrant-and-aggregators.md) — general Black
history, entity-shaped, place-indexed — by asking the map itself where the record is thinnest.
A place-indexed catalog makes its own gaps measurable: every county×decade census row is a
denominator, every published pin is a numerator.

## What it computes

For each county × census decade:

```
coverage_ratio = entity_count / black_population
```

- `black_population` — Black or African American alone population from
  `bb_reference.census_county_decades` (payload key `blackPopulation`, decennial census).
- `entity_count` — published entities attributed to the county in the **active release**
  (`bb_public.release_entities`), read-only.
- Bottom-N counties by `coverage_ratio` become **priority discovery zones**, seeded with
  `GeographicHint`s (`kind: 'region'` — the same kind `scoreObscurity`'s
  `geographicSpecificity` factor boosts) and neutral search queries for the
  plan → gather → extract → decide research-directive loop.

## What it does NOT claim

Same honesty posture as the obscurity methodology
(`OBSCURITY_METHODOLOGY_DISCLAIMER`), stamped as
`methodology_geographic_gap_heuristic_v1` on every result:

- A low ratio means **our catalog is thin there** — not that the community lacks history,
  not that any specific record exists to be found, and never "hidden history" validated.
- Ratios shift as the catalog grows and as reference data is revised.
- Ratios prioritize research attention only. They never authorize publication.
- Counties below a Black-population floor (default 100) are excluded: tiny denominators
  produce noisy ratios that read as overclaims. Zero-population denominators are skipped,
  not treated as infinite gaps.

## Components

| Piece | Location | Role |
|---|---|---|
| Pure scanner | `packages/domain/src/discovery/geographic-gap-scanner.ts` | `computeCoverageGaps` (pure ratio math), `rankCoverageGaps` (lowest first, deterministic tie-breaks), `buildPriorityDiscoveryZones` (hint + query seeding) |
| Tests | `packages/domain/src/discovery/geographic-gap-scanner.test.ts` | ratio math, ranking order, floors, empty input |
| Staff view | `supabase/migrations/20260724000003_coverage_gap_view.sql` | `bb_ops.coverage_gap_by_county_decade` — definer view, staff-only (`bb_auth.is_staff()` in-view + grants), no anon access, read-only |
| Directive preset | `packages/operator-cli/src/lib/geographic-gap-brief.ts` | `runGeographicGapCountyBrief` — one priority county through `createTargetedBriefHandlers` + `runResearchDirective` |
| Methodology doc | this file | — |

## Flow

1. **Scan** (staff/service only): read `bb_ops.coverage_gap_by_county_decade` rows.
2. **Compute + rank** (pure, replayable): feed rows to `computeCoverageGaps` →
   `rankCoverageGaps(gaps, topN)`. Same inputs, same ranking — audit-friendly.
3. **Zone** — `buildPriorityDiscoveryZones(gaps)` collapses county×decade gaps into one zone
   per county (worst decade wins) with `GeographicHint`s and non-essentializing search seeds
   (e.g. `"Black history <county> <state>"`, historical societies, church/school archives).
4. **Brief** — `runGeographicGapCountyBrief(zone, seedUrls, context)` runs
   plan → gather → extract → decide. Gathering is `defaultDirectiveGather` →
   `@repo/security` DNS-pinned safe-fetch of **operator-curated** seed URLs — the scanner
   proposes *places*, operators choose *sources*. Decisions are
   `stage_for_review` / `hold` / `reject` only.
5. **Intake** — staged briefs enter the normal research intake / consensus review lanes.
   Every downstream record still needs evidence, citations, confidence, and dignity review
   before any publication decision — which happens elsewhere, by publication roles.

## Invariants

- **Research cannot publish (ADR-009).** Nothing in this methodology writes to `bb_public`
  or `bb_publication`. The view is read-only; the domain functions are pure; the directive
  decision vocabulary has no publish action.
- **Staff-only surface.** `bb_ops.coverage_gap_by_county_decade` carries an in-view
  `bb_auth.is_staff()` gate plus explicit grants (authenticated + service_role; no anon
  policies, no anon grants). `bb_ops` has no default SELECT privileges, so the schema
  `USAGE` grant exposes exactly this view.
- **Safe fetch only.** All gathering flows through the shared research-directive gather
  path (DNS-pinned `runQuickAddFetch`), never bare `fetch()`.
- **Evidence before assertion; dignity.** Coverage gaps generate *questions*, not claims.
  Zone labels and queries name places and institutions, never individuals; living-person
  and residential-precision rules apply unchanged downstream.

## Integration (barrel exports — parent agent merges; barrels not edited here)

`packages/domain/src/discovery/index.ts` (discovery barrel, already re-exported by the
package barrel via `export * from './discovery/index.js';`):

```typescript
export {
  GAP_SCANNER_METHODOLOGY_VERSION,
  GAP_SCANNER_METHODOLOGY_DISCLAIMER,
  DEFAULT_MIN_BLACK_POPULATION,
  computeCoverageGaps,
  rankCoverageGaps,
  buildPriorityDiscoveryZones,
  type CountyCensusDecadeRow,
  type CountyEntityCountRow,
  type CoverageGap,
  type ComputeCoverageGapsOptions,
  type PriorityDiscoveryZone,
} from './geographic-gap-scanner.js';
```

`packages/operator-cli/src/index.ts` (if the CLI barrel should re-export the preset):

```typescript
export {
  buildGeographicGapBriefSubject,
  createGeographicGapBriefHandlers,
  runGeographicGapCountyBrief,
  type GeographicGapZone,
  type GeographicGapBriefSubject,
  type GeographicGapExtracted,
  type GeographicGapDecision,
} from './lib/geographic-gap-brief.js';
```

Test registration (package.json `test` script additions):

- `packages/domain`: add `src/discovery/geographic-gap-scanner.test.ts`
- (preset is covered by directive-loop tests; add a dedicated test file when the preset
  grows extract/decide logic of its own)

Once `PriorityDiscoveryZone` is exported from the domain barrel, the structural
`GeographicGapZone` type in `geographic-gap-brief.ts` can be replaced by
`import type { PriorityDiscoveryZone } from '@repo/domain';` (shapes are identical).

## Relation to existing methodologies

- **Obscurity scoring** ranks *candidates already found*; the gap scanner decides *where to
  look next*. They compose: zone hints raise `geographicSpecificity` for candidates
  discovered inside a gap county.
- **Place-first query packs** (`wikidata-place-first`) seed by curated state QIDs; gap zones
  give a data-driven county shortlist those packs can expand toward.
- **Empty quadrant** ([vision doc](../methodology/empty-quadrant-and-aggregators.md)):
  aggregators inherit their partners' blind spots; a place-indexed entity catalog can
  *measure* its own blind spots against the census and work them down county by county —
  without ever overclaiming completeness.
