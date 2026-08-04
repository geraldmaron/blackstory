/**
 * Geographic Gap Scanner — coverage-gap methodology for research discovery targeting.
 *
 * Goal: systematically find counties (per census decade) where published Black-history
 * coverage is thin *relative to documented Black population*, then seed targeted
 * discovery there. A low coverage ratio is a **prioritization signal only** — it never
 * asserts that history is absent, that a place is "undocumented" as fact, and it never
 * authorizes publication (ADR-009: research/discovery cannot publish).
 *
 * All functions here are PURE: inputs arrive as parameters (staff-only
 * `bb_ops.coverage_gap_by_county_decade` rows, fixtures, or exports). No DB access,
 * no network, no publish side effects.
 */
import type { GeographicHint } from './types.js';

export const GAP_SCANNER_METHODOLOGY_VERSION = 'geographic-gap.v1' as const;

/** Staff-facing disclaimer — mirrors the obscurity methodology's honesty posture. */
export const GAP_SCANNER_METHODOLOGY_DISCLAIMER = {
  id: 'methodology_geographic_gap_heuristic_v1',
  title: 'About coverage-gap ratios',
  reviewDate: '2026-07-24',
  body:
    'Coverage ratios compare our published entity count for a county against decennial ' +
    'census Black population. A low ratio means our catalog is thin there — not that ' +
    'the community lacks history, nor that any specific record exists to be found. ' +
    'Ratios change as the catalog grows and as census reference data is revised. They ' +
    'prioritize research attention only; they never authorize publication.',
} as const;

/**
 * Counties whose census Black population falls below this floor are excluded by
 * default: tiny denominators make ratios noisy and can read as overclaims.
 */
export const DEFAULT_MIN_BLACK_POPULATION = 100;

/** One census reference reading (from bb_reference.census_county_decades payload). */
export type CountyCensusDecadeRow = {
  /** 5-digit county FIPS (state 2 + county 3), zero-padded. */
  readonly fips5: string;
  /** Decade year, e.g. 2000 / 2010 / 2020. */
  readonly decade: number;
  /** Black or African American alone population for that county × decade. */
  readonly blackPopulation: number;
  /** Optional display labels carried through for zone seeding. */
  readonly countyName?: string;
  readonly stateName?: string;
};

/** Published entity count per county (from bb_public.release_entities, active release). */
export type CountyEntityCountRow = {
  readonly fips5: string;
  /** Count of published entities attributed to the county. Read-only input; never written here. */
  readonly entityCount: number;
};

export type CoverageGap = {
  readonly methodologyVersion: typeof GAP_SCANNER_METHODOLOGY_VERSION;
  readonly fips5: string;
  readonly decade: number;
  readonly blackPopulation: number;
  readonly entityCount: number;
  /** coverage_ratio = entity_count / black_population (0 when no entities). */
  readonly coverageRatio: number;
  /** Same signal at a readable scale: published entities per 10,000 Black residents. */
  readonly entitiesPer10k: number;
  readonly countyName?: string;
  readonly stateName?: string;
  readonly disclaimerId: typeof GAP_SCANNER_METHODOLOGY_DISCLAIMER.id;
  readonly computedAt: string;
};

export type ComputeCoverageGapsOptions = {
  readonly censusRows: readonly CountyCensusDecadeRow[];
  readonly entityCounts: readonly CountyEntityCountRow[];
  /** ISO timestamp stamped onto every gap for audit replay. */
  readonly computedAt: string;
  /** Exclude counties below this Black-population floor (default 100). */
  readonly minBlackPopulation?: number;
};

function round6(value: number): number {
  return Number(value.toFixed(6));
}

/**
 * PURE per-county×decade coverage computation.
 *
 * coverage_ratio = entity_count / black_population.
 * Rows with blackPopulation <= 0 or below `minBlackPopulation` are skipped —
 * a zero denominator is undefined, not "infinite gap".
 */
export function computeCoverageGaps(opts: ComputeCoverageGapsOptions): readonly CoverageGap[] {
  const floor = opts.minBlackPopulation ?? DEFAULT_MIN_BLACK_POPULATION;
  const countsByFips = new Map<string, number>();
  for (const row of opts.entityCounts) {
    countsByFips.set(row.fips5, (countsByFips.get(row.fips5) ?? 0) + row.entityCount);
  }

  const gaps: CoverageGap[] = [];
  for (const census of opts.censusRows) {
    if (!Number.isFinite(census.blackPopulation) || census.blackPopulation <= 0) continue;
    if (census.blackPopulation < floor) continue;
    const entityCount = countsByFips.get(census.fips5) ?? 0;
    const coverageRatio = round6(entityCount / census.blackPopulation);
    gaps.push({
      methodologyVersion: GAP_SCANNER_METHODOLOGY_VERSION,
      fips5: census.fips5,
      decade: census.decade,
      blackPopulation: census.blackPopulation,
      entityCount,
      coverageRatio,
      entitiesPer10k: round6((entityCount / census.blackPopulation) * 10_000),
      ...(census.countyName !== undefined ? { countyName: census.countyName } : {}),
      ...(census.stateName !== undefined ? { stateName: census.stateName } : {}),
      disclaimerId: GAP_SCANNER_METHODOLOGY_DISCLAIMER.id,
      computedAt: opts.computedAt,
    });
  }
  return gaps;
}

/**
 * Lowest-coverage counties first (the gap frontier). Deterministic tie-breaks:
 * larger Black population first (bigger community, thinner record), then fips5,
 * then decade — so audit replays rank identically.
 */
export function rankCoverageGaps(
  gaps: readonly CoverageGap[],
  topN: number,
): readonly CoverageGap[] {
  if (topN <= 0) return [];
  return [...gaps]
    .sort(
      (left, right) =>
        left.coverageRatio - right.coverageRatio ||
        right.blackPopulation - left.blackPopulation ||
        left.fips5.localeCompare(right.fips5) ||
        left.decade - right.decade,
    )
    .slice(0, topN);
}

/** Seeded geographic target for the research-directive loop (plan → gather → extract → decide). */
export type PriorityDiscoveryZone = {
  readonly methodologyVersion: typeof GAP_SCANNER_METHODOLOGY_VERSION;
  readonly fips5: string;
  /** Human label, e.g. "Lowndes County, Alabama" or "county FIPS 01085". */
  readonly countyLabel: string;
  readonly stateName?: string;
  /** Worst (lowest) coverage ratio observed across supplied decades. */
  readonly worstCoverageRatio: number;
  /** Decade carrying the worst ratio. */
  readonly worstDecade: number;
  /** All decades represented for this county in the input gaps. */
  readonly decades: readonly number[];
  /** Discovery-shaped hints matching `GeographicHint` (city/region boosts obscurity scoring). */
  readonly geographicHints: readonly GeographicHint[];
  /** Neutral, non-essentializing search seeds for targeted-brief planning. */
  readonly searchQueries: readonly string[];
  readonly disclaimerId: typeof GAP_SCANNER_METHODOLOGY_DISCLAIMER.id;
};

function zoneLabel(gap: CoverageGap): string {
  if (gap.countyName && gap.stateName) return `${gap.countyName}, ${gap.stateName}`;
  if (gap.countyName) return gap.countyName;
  return `county FIPS ${gap.fips5}`;
}

/**
 * Collapses county×decade gaps into one prioritized zone per county, seeded with
 * `GeographicHint`s (kind 'region' for the county — the same kind
 * `geographicSpecificityRaw` boosts in obscurity scoring) and search queries for
 * the targeted-brief directive loop. Ordered worst coverage first.
 */
export function buildPriorityDiscoveryZones(
  gaps: readonly CoverageGap[],
): readonly PriorityDiscoveryZone[] {
  const byCounty = new Map<string, CoverageGap[]>();
  for (const gap of gaps) {
    const bucket = byCounty.get(gap.fips5);
    if (bucket) bucket.push(gap);
    else byCounty.set(gap.fips5, [gap]);
  }

  const zones: PriorityDiscoveryZone[] = [];
  for (const countyGaps of byCounty.values()) {
    const worst = rankCoverageGaps(countyGaps, 1)[0];
    if (!worst) continue;
    const label = zoneLabel(worst);
    const hints: GeographicHint[] = [
      { text: label, kind: 'region', confidence: 0.9 },
      ...(worst.stateName
        ? [{ text: worst.stateName, kind: 'state' as const, confidence: 0.8 }]
        : []),
    ];
    const placeQuery =
      worst.stateName && worst.countyName ? `${worst.countyName} ${worst.stateName}` : label;
    zones.push({
      methodologyVersion: GAP_SCANNER_METHODOLOGY_VERSION,
      fips5: worst.fips5,
      countyLabel: label,
      ...(worst.stateName !== undefined ? { stateName: worst.stateName } : {}),
      worstCoverageRatio: worst.coverageRatio,
      worstDecade: worst.decade,
      decades: [...new Set(countyGaps.map((gap) => gap.decade))].sort((a, b) => a - b),
      geographicHints: hints,
      searchQueries: [
        `Black history ${placeQuery}`,
        `African American community ${placeQuery} historical society`,
        `${placeQuery} Black church school archive`,
      ],
      disclaimerId: GAP_SCANNER_METHODOLOGY_DISCLAIMER.id,
    });
  }

  return zones.sort(
    (left, right) =>
      left.worstCoverageRatio - right.worstCoverageRatio || left.fips5.localeCompare(right.fips5),
  );
}
