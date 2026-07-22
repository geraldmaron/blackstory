/**
 * Demographics read routing for public web surfaces (`/data`, homepage data pulse).
 * Reads materialized census snapshots from `bb_public.materialized_snapshots` when
 * `PUBLIC_DATA_SOURCE=postgres`; otherwise returns empty/absent summaries.
 */
import {
  computeStatePopulationChangesFromDecades,
  summarizePhase1IndicatorCatalog,
  type AcsCoverageSummary,
  type CensusCountyDecadeDecade,
  type HateCrimeYearSummary,
  type HistoricalStatePopulationCoverage,
  type NationalPopulationTimelineSnapshot,
  type OpportunityAtlasCoverageSummary,
  type Phase1IndicatorCoverageSummary,
  type StatePopulationByDecade,
  type StatePopulationChange,
} from '@repo/domain';
import { fetchMaterializedSnapshot } from '../public-data/public-readers';

type StatePopulationByDecadeSnapshot = {
  readonly rows: readonly StatePopulationByDecade[];
  readonly generatedAt?: string;
  readonly contentHash?: string;
};

function isTimelineSnapshot(value: unknown): value is NationalPopulationTimelineSnapshot {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as NationalPopulationTimelineSnapshot;
  return Array.isArray(candidate.rows) && Array.isArray(candidate.changes);
}

function isStatePopulationSnapshot(value: unknown): value is StatePopulationByDecadeSnapshot {
  if (value === null || typeof value !== 'object') return false;
  return Array.isArray((value as StatePopulationByDecadeSnapshot).rows);
}

function isHistoricalCoverageSnapshot(
  value: unknown,
): value is HistoricalStatePopulationCoverage & { readonly generatedAt?: string } {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as HistoricalStatePopulationCoverage;
  return typeof candidate.rowCount === 'number' && typeof candidate.stateCount === 'number';
}

function isOpportunityCoverageSnapshot(value: unknown): value is OpportunityAtlasCoverageSummary {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as OpportunityAtlasCoverageSummary;
  return typeof candidate.tractCount === 'number' && typeof candidate.source === 'string';
}

export async function getNationalPopulationTimelineSnapshot(): Promise<NationalPopulationTimelineSnapshot | null> {
  const payload = await fetchMaterializedSnapshot('nationalPopulationTimeline');
  return isTimelineSnapshot(payload) ? payload : null;
}

export async function getStatePopulationChanges(
  fromDecade: CensusCountyDecadeDecade,
  toDecade: CensusCountyDecadeDecade,
): Promise<readonly StatePopulationChange[]> {
  const payload = await fetchMaterializedSnapshot('statePopulationByDecade');
  if (!isStatePopulationSnapshot(payload)) return [];
  return computeStatePopulationChangesFromDecades(payload.rows, fromDecade, toDecade);
}

export async function getHistoricalStatePopulationCoverage(): Promise<
  HistoricalStatePopulationCoverage | undefined
> {
  const payload = await fetchMaterializedSnapshot('historicalStatePopulationCoverage');
  if (!isHistoricalCoverageSnapshot(payload)) return undefined;
  const { generatedAt: _generatedAt, contentHash: _contentHash, ...coverage } = payload as HistoricalStatePopulationCoverage & {
    readonly generatedAt?: string;
    readonly contentHash?: string;
  };
  return coverage;
}

export async function getOpportunityAtlasCoverageSummary(): Promise<
  OpportunityAtlasCoverageSummary | undefined
> {
  const payload = await fetchMaterializedSnapshot('opportunityAtlasCoverage');
  if (!isOpportunityCoverageSnapshot(payload)) return undefined;
  const { generatedAt: _generatedAt, contentHash: _contentHash, ...summary } = payload as OpportunityAtlasCoverageSummary & {
    readonly generatedAt?: string;
    readonly contentHash?: string;
  };
  return summary;
}

/** TODO(postgres-cutover): aggregate `bb_reference.acs_*` rollups. */
export async function getAcsCoverageSummary(): Promise<AcsCoverageSummary | undefined> {
  return undefined;
}

/**
 * Phase 1 curated indicator catalog is always available from domain vocabulary.
 * Observation counts come from a materialized snapshot when present.
 */
export async function getPhase1IndicatorCoverageSummary(): Promise<
  Phase1IndicatorCoverageSummary | undefined
> {
  const catalog = summarizePhase1IndicatorCatalog();
  const payload = await fetchMaterializedSnapshot('phase1IndicatorCoverage');
  const sampleObservationCount =
    payload !== null &&
    typeof payload === 'object' &&
    typeof (payload as { sampleObservationCount?: unknown }).sampleObservationCount === 'number'
      ? (payload as { sampleObservationCount: number }).sampleObservationCount
      : 0;
  return {
    metricCount: catalog.metricCount,
    themes: [...catalog.themes],
    sampleObservationCount,
    source: 'phase1-indicator-catalog',
    sourceUrl: '/methodology',
  };
}

/** TODO(postgres-cutover): read `bb_reference.hate_crime_county_years` rollups. */
export async function getHateCrimeYearSummary(_year: string): Promise<HateCrimeYearSummary | undefined> {
  return undefined;
}

/** TODO(postgres-cutover): read `bb_reference.hate_crime_county_years` rollups. */
export async function getHateCrimeYearSummaries(
  _years: readonly string[],
): Promise<readonly HateCrimeYearSummary[]> {
  return [];
}

export type {
  AcsCoverageSummary,
  HateCrimeYearSummary,
  HistoricalStatePopulationCoverage,
  NationalPopulationTimelineSnapshot,
  OpportunityAtlasCoverageSummary,
  Phase1IndicatorCoverageSummary,
  StatePopulationChange,
};
