/**
 * Client-safe state decennial Black population types and pure helpers for the home hero
 * density layer. Absolute counts deepen copper across decades (global thresholds — not
 * relative ranking within a single frame). Callers supply a compact index (static JSON);
 * this module never fetches.
 *
 * Missing state+decade rows are omitted (unknown fill) — never painted as zero population.
 * Sparse early decades reflect census admission/coverage, not invented gaps.
 */
import type { UsStateInfo } from './us-geography.js';

/** Compact file/API record — matches `apps/web/public/geo/state-population-decades.json`. */
export type StatePopulationRecord = {
  readonly totalPopulation: number;
  readonly blackPopulation: number;
};

/** Compact map index: state FIPS → decade vintage → counts. Omitted decades mean no published row. */
export type StatePopulationIndex = {
  readonly vintages: readonly string[];
  readonly states: Readonly<
    Record<string, Readonly<Partial<Record<string, StatePopulationRecord>>>>
  >;
};

/**
 * Absolute Black-population tiers reused by the hero density channel
 * (`documented` / `emerging` / `concentrated`). Thresholds are global across decades so
 * deeper copper always means more people, not a within-frame relative rank.
 *
 * - documented: below 50,000
 * - emerging: ≥ 50,000
 * - concentrated: ≥ 250,000
 */
export const BLACK_POPULATION_EMERGING_MIN = 50_000;
export const BLACK_POPULATION_CONCENTRATED_MIN = 250_000;

export type BlackPopulationDensityTier = 'documented' | 'emerging' | 'concentrated';

export type StateBlackPopulationDensityLevel = {
  readonly stateFips: string;
  readonly statePostalCode: string;
  readonly stateName: string;
  /** Absolute Black population for the vintage — drives the copper fill. */
  readonly count: number;
  readonly tier: BlackPopulationDensityTier;
};

/** Wire/file shape before normalizing to `StatePopulationRecord`. */
export type StatePopulationIndexFile = {
  readonly vintages?: readonly string[];
  readonly states?: Readonly<
    Record<
      string,
      Readonly<Partial<Record<string, { readonly total?: number; readonly black?: number }>>>
    >
  >;
};

function parseRecord(
  raw:
    | {
        readonly total?: number;
        readonly black?: number;
      }
    | undefined,
): StatePopulationRecord | undefined {
  if (!raw || typeof raw.total !== 'number' || typeof raw.black !== 'number') return undefined;
  if (!Number.isFinite(raw.total) || !Number.isFinite(raw.black)) return undefined;
  if (raw.total < 0 || raw.black < 0) return undefined;
  return { totalPopulation: raw.total, blackPopulation: raw.black };
}

/** Normalize the committed static JSON (compact `total`/`black` keys) into the domain index. */
export function parseStatePopulationIndexFile(
  payload: StatePopulationIndexFile,
): StatePopulationIndex {
  const vintages = [...(payload.vintages ?? [])].filter((v) => /^\d{4}$/.test(v));
  const states: Record<string, Partial<Record<string, StatePopulationRecord>>> = {};
  for (const [fips, byDecade] of Object.entries(payload.states ?? {})) {
    const padded = fips.padStart(2, '0');
    const decadeMap: Partial<Record<string, StatePopulationRecord>> = {};
    for (const [decade, counts] of Object.entries(byDecade ?? {})) {
      const record = parseRecord(counts);
      if (record) decadeMap[decade] = record;
    }
    if (Object.keys(decadeMap).length > 0) {
      states[padded] = decadeMap;
    }
  }
  return { vintages, states };
}

export function readStatePopulation(
  index: StatePopulationIndex | undefined,
  stateFips: string,
  decade: string,
): StatePopulationRecord | undefined {
  if (!index) return undefined;
  return index.states[stateFips.padStart(2, '0')]?.[decade];
}

export function bucketBlackPopulationTier(blackPopulation: number): BlackPopulationDensityTier {
  if (blackPopulation >= BLACK_POPULATION_CONCENTRATED_MIN) return 'concentrated';
  if (blackPopulation >= BLACK_POPULATION_EMERGING_MIN) return 'emerging';
  return 'documented';
}

/** Latest census vintage present in the index (e.g. `2020`), or undefined when empty. */
export function latestStatePopulationVintage(index: StatePopulationIndex): string | undefined {
  const numeric = index.vintages
    .map((v) => Number.parseInt(v, 10))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b);
  const last = numeric.at(-1);
  return last === undefined ? undefined : String(last);
}

/** Sum of published Black counts for one vintage — omits missing state rows. */
export function sumStateBlackPopulation(index: StatePopulationIndex, decade: string): number {
  let total = 0;
  for (const byDecade of Object.values(index.states)) {
    const record = byDecade[decade];
    if (record) total += record.blackPopulation;
  }
  return total;
}

/**
 * Absolute Black-population density levels for one census vintage. States without a published
 * row for that decade are omitted (unknown fill) — never painted as zero.
 */
export function buildStateBlackPopulationDensityLevels(
  index: StatePopulationIndex,
  decade: string,
  stateLookup: readonly UsStateInfo[],
): readonly StateBlackPopulationDensityLevel[] {
  const byFips = new Map(stateLookup.map((state) => [state.fips, state]));
  const levels: StateBlackPopulationDensityLevel[] = [];
  for (const [stateFips, byDecade] of Object.entries(index.states)) {
    const record = byDecade[decade];
    if (!record) continue;
    const info = byFips.get(stateFips.padStart(2, '0'));
    if (!info) continue;
    levels.push({
      stateFips: info.fips,
      statePostalCode: info.postalCode,
      stateName: info.name,
      count: record.blackPopulation,
      tier: bucketBlackPopulationTier(record.blackPopulation),
    });
  }
  return levels.sort((a, b) => a.stateFips.localeCompare(b.stateFips));
}
