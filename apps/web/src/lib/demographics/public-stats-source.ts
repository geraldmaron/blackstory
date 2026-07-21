/**
 * Demographics read routing for public web surfaces (`/data`, homepage data pulse).
 * Postgres mode reads materialized census snapshots from `bb_public.materialized_snapshots`;
 * Firestore remains the default until `PUBLIC_DATA_SOURCE=postgres`.
 */
import {
  computeStatePopulationChangesFromDecades,
  getAcsCoverageSummary as getFirestoreAcsCoverageSummary,
  getHateCrimeYearSummaries as getFirestoreHateCrimeYearSummaries,
  getHateCrimeYearSummary as getFirestoreHateCrimeYearSummary,
  getHistoricalStatePopulationCoverage as getFirestoreHistoricalStatePopulationCoverage,
  getNationalPopulationTimelineSnapshot as getFirestoreNationalPopulationTimelineSnapshot,
  getOpportunityAtlasCoverageSummary as getFirestoreOpportunityAtlasCoverageSummary,
  getStatePopulationChanges as getFirestoreStatePopulationChanges,
  type AcsCoverageSummary,
  type CensusCountyDecadeDecade,
  type HateCrimeYearSummary,
  type HistoricalStatePopulationCoverage,
  type NationalPopulationTimelineSnapshot,
  type OpportunityAtlasCoverageSummary,
  type StatePopulationChange,
  type StatePopulationByDecadeSnapshot,
} from '@repo/firebase';
import { fetchMaterializedSnapshot } from '../public-data/public-readers';
import { isPostgresPublicDataSource } from '../public-data/live-policy';

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
  if (!isPostgresPublicDataSource()) {
    return getFirestoreNationalPopulationTimelineSnapshot();
  }
  const payload = await fetchMaterializedSnapshot('nationalPopulationTimeline');
  return isTimelineSnapshot(payload) ? payload : null;
}

export async function getStatePopulationChanges(
  fromDecade: CensusCountyDecadeDecade,
  toDecade: CensusCountyDecadeDecade,
): Promise<readonly StatePopulationChange[]> {
  if (!isPostgresPublicDataSource()) {
    return getFirestoreStatePopulationChanges(fromDecade, toDecade);
  }
  const payload = await fetchMaterializedSnapshot('statePopulationByDecade');
  if (!isStatePopulationSnapshot(payload)) return [];
  return computeStatePopulationChangesFromDecades(payload.rows, fromDecade, toDecade);
}

export async function getHistoricalStatePopulationCoverage(): Promise<
  HistoricalStatePopulationCoverage | undefined
> {
  if (!isPostgresPublicDataSource()) {
    return getFirestoreHistoricalStatePopulationCoverage();
  }
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
  if (!isPostgresPublicDataSource()) {
    return getFirestoreOpportunityAtlasCoverageSummary();
  }
  const payload = await fetchMaterializedSnapshot('opportunityAtlasCoverage');
  if (!isOpportunityCoverageSnapshot(payload)) return undefined;
  const { generatedAt: _generatedAt, contentHash: _contentHash, ...summary } = payload as OpportunityAtlasCoverageSummary & {
    readonly generatedAt?: string;
    readonly contentHash?: string;
  };
  return summary;
}

/** TODO(postgres-cutover): aggregate `bb_reference.acs_*` instead of Firestore collection counts. */
export async function getAcsCoverageSummary(): Promise<AcsCoverageSummary | undefined> {
  if (isPostgresPublicDataSource()) {
    return undefined;
  }
  return getFirestoreAcsCoverageSummary();
}

/** TODO(postgres-cutover): read `bb_reference.hate_crime_county_years` rollups. */
export async function getHateCrimeYearSummary(year: string): Promise<HateCrimeYearSummary | undefined> {
  if (isPostgresPublicDataSource()) {
    return undefined;
  }
  return getFirestoreHateCrimeYearSummary(year);
}

/** TODO(postgres-cutover): read `bb_reference.hate_crime_county_years` rollups. */
export async function getHateCrimeYearSummaries(
  years: readonly string[],
): Promise<readonly HateCrimeYearSummary[]> {
  if (isPostgresPublicDataSource()) {
    return [];
  }
  return getFirestoreHateCrimeYearSummaries(years);
}

export type {
  AcsCoverageSummary,
  HateCrimeYearSummary,
  HistoricalStatePopulationCoverage,
  NationalPopulationTimelineSnapshot,
  OpportunityAtlasCoverageSummary,
  StatePopulationChange,
};
