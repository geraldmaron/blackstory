/**
 * Pure types and helpers for public `/data` and homepage demographic summaries.
 * Postgres materialized snapshots and release artifacts carry these shapes; apps/web reads
 * them without a Firebase runtime dependency.
 */
import { computeGrowthRecord } from './combination-rules.js';
import type {
  NationalPopulationChange,
  NationalPopulationTimelineRow,
} from './census-national-decade.js';

/** Decennial county vintages carried in state/county rollups (2000–2020 SF1/PL). */
export type CensusCountyDecadeDecade = '2000' | '2010' | '2020';

export type StatePopulationByDecade = {
  readonly stateFips: string;
  readonly decade: CensusCountyDecadeDecade;
  readonly countyCount: number;
  readonly totalPopulation: number;
  readonly blackPopulation: number;
};

export type StatePopulationChange = {
  readonly stateFips: string;
  readonly fromDecade: CensusCountyDecadeDecade;
  readonly toDecade: CensusCountyDecadeDecade;
  readonly blackAbsoluteChange: number;
  readonly blackPercentChange: number | null;
  readonly shareFrom: number;
  readonly shareTo: number;
  readonly shareChangePp: number;
  readonly blackPopulationFrom: number;
  readonly blackPopulationTo: number;
  readonly totalPopulationFrom: number;
  readonly totalPopulationTo: number;
};

/** A deduplicated citation surfaced with the national population timeline. */
export type NationalTimelineSource = {
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly label: string;
};

export type NationalPopulationTimelineSnapshot = {
  readonly rows: readonly NationalPopulationTimelineRow[];
  readonly changes: readonly NationalPopulationChange[];
  readonly sources: readonly NationalTimelineSource[];
  readonly generatedAt: string;
  readonly contentHash: string;
};

export type AcsCoverageSummary = {
  readonly vintage: string;
  readonly countyCount: number;
  readonly tractCount: number;
  readonly source: string;
  readonly sourceUrl: string;
};

/** Coverage for Phase 1 curated context indicators (catalog + optional observation counts). */
export type Phase1IndicatorCoverageSummary = {
  readonly metricCount: number;
  readonly themes: readonly string[];
  readonly sampleObservationCount: number;
  readonly source: string;
  readonly sourceUrl: string;
};

export type HistoricalStatePopulationCoverage = {
  readonly rowCount: number;
  readonly stateCount: number;
  readonly decadeMin: string;
  readonly decadeMax: string;
  readonly source: string;
  readonly sourceUrl: string;
};

export type HateCrimeYearSummary = {
  readonly year: string;
  readonly incidents: number;
  readonly antiBlackIncidents: number;
  readonly reportingCountyYears: number;
  readonly nationalParticipatingAgenciesPct?: number;
  readonly source: string;
  readonly sourceUrl: string;
};

export type OpportunityAtlasOutcomeFieldCoverage = {
  readonly field: string;
  readonly label: string;
  readonly tractCount: number;
};

export type OpportunityAtlasHistogramBin = {
  readonly id: string;
  readonly label: string;
  readonly minInclusive: number;
  readonly maxExclusive: number;
  readonly tractCount: number;
};

export type OpportunityAtlasCoverageSummary = {
  readonly tractCount: number;
  readonly outcomeFieldCoverage: readonly OpportunityAtlasOutcomeFieldCoverage[];
  readonly kfrBlackP25Histogram: readonly OpportunityAtlasHistogramBin[];
  readonly source: string;
  readonly sourceUrl: string;
  readonly license: string;
};

/** Census state FIPS outside `US_STATES` — decennial county rollups still include territories. */
export const US_TERRITORY_FIPS_NAMES: Readonly<Record<string, string>> = {
  '60': 'American Samoa',
  '66': 'Guam',
  '69': 'Northern Mariana Islands',
  '72': 'Puerto Rico',
  '78': 'U.S. Virgin Islands',
};

function blackPopulationShare(blackPopulation: number, totalPopulation: number): number {
  return totalPopulation === 0 ? 0 : (blackPopulation / totalPopulation) * 100;
}

export function computeStatePopulationChange(
  from: StatePopulationByDecade,
  to: StatePopulationByDecade,
): StatePopulationChange {
  const growth = computeGrowthRecord(
    {
      observationId: `us_${from.stateFips}_${from.decade}_black`,
      estimate: from.blackPopulation,
    },
    {
      observationId: `us_${to.stateFips}_${to.decade}_black`,
      estimate: to.blackPopulation,
    },
  );
  const shareFrom = blackPopulationShare(from.blackPopulation, from.totalPopulation);
  const shareTo = blackPopulationShare(to.blackPopulation, to.totalPopulation);
  return {
    stateFips: from.stateFips,
    fromDecade: from.decade,
    toDecade: to.decade,
    blackAbsoluteChange: growth.absoluteChange,
    blackPercentChange: growth.percentChange,
    shareFrom,
    shareTo,
    shareChangePp: shareTo - shareFrom,
    blackPopulationFrom: from.blackPopulation,
    blackPopulationTo: to.blackPopulation,
    totalPopulationFrom: from.totalPopulation,
    totalPopulationTo: to.totalPopulation,
  };
}

export function computeStatePopulationChangesFromDecades(
  rows: readonly StatePopulationByDecade[],
  fromDecade: CensusCountyDecadeDecade,
  toDecade: CensusCountyDecadeDecade,
): StatePopulationChange[] {
  const fromRows = new Map(
    rows.filter((row) => row.decade === fromDecade).map((row) => [row.stateFips, row]),
  );
  const toRows = new Map(
    rows.filter((row) => row.decade === toDecade).map((row) => [row.stateFips, row]),
  );
  const changes: StatePopulationChange[] = [];
  for (const [stateFips, fromRow] of fromRows) {
    const toRow = toRows.get(stateFips);
    if (!toRow) continue;
    changes.push(computeStatePopulationChange(fromRow, toRow));
  }
  return changes.sort((a, b) => Math.abs(b.blackAbsoluteChange) - Math.abs(a.blackAbsoluteChange));
}

/** Merge domain `US_STATES` with territory FIPS for census rollups on `/data`. */
export function buildStateFipsNameMap(
  usStates: readonly { readonly fips: string; readonly name: string }[],
): Readonly<Record<string, string>> {
  return {
    ...Object.fromEntries(usStates.map((state) => [state.fips, state.name])),
    ...US_TERRITORY_FIPS_NAMES,
  };
}

export function resolveStateFipsName(
  stateFips: string,
  nameByFips: Readonly<Record<string, string>>,
): string {
  return nameByFips[stateFips] ?? `State ${stateFips}`;
}

export type {
  NationalPopulationChange,
  NationalPopulationTimelineRow,
};
