/**
 * Temporal Gap Discovery — decade coverage audit (pure, deterministic).
 *
 * Goal: identify decades where the catalog is thin *relative to its own average density*
 * so era-specific discovery campaigns can be launched with period-appropriate query packs
 * (see `../query-packs/temporal-era/index.js`).
 *
 * A thin decade is a catalog-conditioned signal only. It never claims historical
 * underrepresentation as fact and never authorizes publication (ADR-009: research
 * workers cannot publish — this module performs no I/O and no writes).
 *
 * Core factor per decade d over the supplied count map:
 *
 *   avg = Σ count(d) / |decades|
 *   T(d) = clip01( 1 − count(d) / avg )
 *
 * T ∈ [0, 1]. Higher = thinner relative to the supplied catalog slice. Decades at or
 * above average density clip to 0. Methodology version is stamped on every report
 * for audit replay, mirroring `obscurity.ts`.
 */

export const TEMPORAL_GAP_METHODOLOGY_VERSION = 'temporal-gap.v1' as const;

/** Public-safe disclaimer — not folded into DISCLAIMER_CLASSES (constitution-locked set). */
export const TEMPORAL_GAP_METHODOLOGY_DISCLAIMER = {
  id: 'methodology_temporal_gap_heuristic_v1',
  title: 'About temporal coverage scores',
  reviewDate: '2026-07-24',
  body:
    'Temporal density factors are a relative, catalog-conditioned heuristic. A high factor ' +
    'means our current catalog holds fewer dated entries for that decade than its own ' +
    'average — not that the decade is historically less documented, less important, or ' +
    '"hidden history" validated. Factors change as the catalog grows. They never authorize ' +
    'publication by themselves.',
} as const;

/**
 * PROPOSED (not wired): weight for a temporalDensity factor in a future obscurity.v2.
 * `scoreObscurity` / `OBSCURITY_WEIGHTS` in `./obscurity.ts` are intentionally NOT
 * modified by this bead — see docs/research/temporal-gap-discovery.md for the full
 * renormalization proposal.
 */
export const PROPOSED_OBSCURITY_V2_TEMPORAL_WEIGHT = 0.12 as const;

/** Decade start year as a 4-digit string ending in 0, e.g. '1860' (compatible with `PopulationDecade`). */
export type DecadeKey = string;

const DECADE_KEY_PATTERN = /^\d{3}0$/;
const MIN_DECADE = 1790;
const MAX_DECADE = 2020;

export function isDecadeKeyValid(decade: string): boolean {
  if (!DECADE_KEY_PATTERN.test(decade)) {
    return false;
  }
  const year = Number(decade);
  return year >= MIN_DECADE && year <= MAX_DECADE;
}

export function assertDecadeKeyValid(decade: string): void {
  if (!isDecadeKeyValid(decade)) {
    throw new Error(
      `Invalid decade key "${decade}" — expected a decade start year between ${MIN_DECADE} and ${MAX_DECADE} (e.g. "1860")`,
    );
  }
}

/** Catalog entity counts keyed by decade start year, e.g. { '1860': 4, '1900': 18 }. */
export type EntityCountByDecade = Readonly<Record<string, number>>;

export type DecadeCoverage = {
  readonly decade: DecadeKey;
  /** Catalog entity count observed for this decade. */
  readonly count: number;
  /** count / averageCountPerDecade (0 when the whole slice is empty). */
  readonly densityRatio: number;
  /** T = clip01(1 − densityRatio). Higher = thinner decade. */
  readonly temporalDensityFactor: number;
  readonly rationale: string;
};

export type DecadeCoverageReport = {
  readonly methodologyVersion: typeof TEMPORAL_GAP_METHODOLOGY_VERSION;
  readonly totalEntities: number;
  readonly decadeCount: number;
  readonly averageCountPerDecade: number;
  /** Sorted ascending by decade for deterministic replay. */
  readonly coverage: readonly DecadeCoverage[];
  readonly disclaimerId: typeof TEMPORAL_GAP_METHODOLOGY_DISCLAIMER.id;
};

function clip01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

/**
 * Compute per-decade catalog density and the temporal density factor T = 1 − (count/avg).
 * Pure function — no I/O, no publish side effects, deterministic output ordering.
 *
 * Edge case: when every supplied count is 0 (avg = 0) there is no *relative* gap signal;
 * every decade reports densityRatio 0 and temporalDensityFactor 0 with an explicit
 * rationale, rather than claiming everything is maximally thin.
 */
export function computeDecadeCoverage(
  entityCountByDecade: EntityCountByDecade,
): DecadeCoverageReport {
  const entries = Object.entries(entityCountByDecade);
  if (entries.length === 0) {
    throw new Error('computeDecadeCoverage requires at least one decade count');
  }
  for (const [decade, count] of entries) {
    assertDecadeKeyValid(decade);
    if (!Number.isInteger(count) || !Number.isFinite(count) || count < 0) {
      throw new Error(
        `Entity count for decade ${decade} must be a non-negative integer, got ${count}`,
      );
    }
  }

  const totalEntities = entries.reduce((sum, [, count]) => sum + count, 0);
  const decadeCount = entries.length;
  const averageCountPerDecade = round4(totalEntities / decadeCount);

  const coverage: DecadeCoverage[] = entries
    .slice()
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([decade, count]) => {
      if (averageCountPerDecade === 0) {
        return {
          decade,
          count,
          densityRatio: 0,
          temporalDensityFactor: 0,
          rationale:
            'Catalog slice has no dated entities in any supplied decade — no relative gap signal.',
        };
      }
      const densityRatio = round4(count / averageCountPerDecade);
      const temporalDensityFactor = round4(clip01(1 - densityRatio));
      return {
        decade,
        count,
        densityRatio,
        temporalDensityFactor,
        rationale:
          `Decade ${decade}s holds ${count} of ${totalEntities} dated entities ` +
          `(density ${densityRatio.toFixed(4)} vs catalog average ${averageCountPerDecade.toFixed(4)}) → ` +
          `T=${temporalDensityFactor.toFixed(4)}.`,
      };
    });

  return {
    methodologyVersion: TEMPORAL_GAP_METHODOLOGY_VERSION,
    totalEntities,
    decadeCount,
    averageCountPerDecade,
    coverage,
    disclaimerId: TEMPORAL_GAP_METHODOLOGY_DISCLAIMER.id,
  };
}

/**
 * Rank the thinnest decades: highest temporalDensityFactor first, decade ascending as
 * deterministic tie-break (mirrors `rankByObscurity` tie-break style). Returns at most
 * `topN` entries.
 */
export function rankThinDecades(
  coverage: DecadeCoverageReport,
  topN: number,
): readonly DecadeCoverage[] {
  if (!Number.isInteger(topN) || topN < 1) {
    throw new Error(`rankThinDecades topN must be a positive integer, got ${topN}`);
  }
  return [...coverage.coverage]
    .sort(
      (left, right) =>
        right.temporalDensityFactor - left.temporalDensityFactor ||
        left.decade.localeCompare(right.decade),
    )
    .slice(0, topN);
}
