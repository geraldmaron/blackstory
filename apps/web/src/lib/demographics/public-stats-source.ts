/**
 * Demographics read routing for public web surfaces (`/data`, homepage data pulse).
 * Reads materialized census snapshots from `bb_public.materialized_snapshots` when
 * `PUBLIC_DATA_SOURCE=postgres`; otherwise returns empty/absent summaries.
 *
 * ACS and FBI hate-crime summaries deliberately do NOT live here. Those datasets belong in the
 * typed `bb_reference.statistical_series` / `statistical_observations` model — the opaque
 * `acs_*` / `hate_crime_county_years` payload tables are the legacy loader path (see
 * supabase/migrations/20260721220000_statistical_series_observations.sql). A bespoke rollup here
 * would drop margin of error, boundary version, and source-variable provenance, which is the
 * exact loss the typed model was introduced to prevent.
 */
import {
  computeStatePopulationChangesFromDecades,
  type CensusCountyDecadeDecade,
  type HistoricalStatePopulationCoverage,
  type NationalPopulationTimelineSnapshot,
  type OpportunityAtlasCoverageSummary,
  type StatePopulationByDecade,
  type StatePopulationChange,
} from '@repo/domain';
import { summarizePhase1IndicatorCatalog } from '@repo/domain/statistics/phase1-indicator-catalog';
import type { Phase1IndicatorCoverageSummary } from '@repo/domain/statistics/public-data-summaries';
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
  const {
    generatedAt: _generatedAt,
    contentHash: _contentHash,
    ...coverage
  } = payload as HistoricalStatePopulationCoverage & {
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
  const {
    generatedAt: _generatedAt,
    contentHash: _contentHash,
    ...summary
  } = payload as OpportunityAtlasCoverageSummary & {
    readonly generatedAt?: string;
    readonly contentHash?: string;
  };
  return summary;
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

export type {
  HistoricalStatePopulationCoverage,
  NationalPopulationTimelineSnapshot,
  OpportunityAtlasCoverageSummary,
  Phase1IndicatorCoverageSummary,
  StatePopulationChange,
};
