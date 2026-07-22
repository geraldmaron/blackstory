/**
 * Server-side reader for `/data` Phase 1 indicator chart bundles — Postgres snapshot,
 * live `bb_reference.statistical_observations`, or domain fixture fallback.
 */
import {
  DATA_PAGE_INDICATOR_FIXTURE_BUNDLE,
  isDataPageIndicatorBundle,
  mergeDataPageIndicatorBundle,
  type DataPageIndicatorBundle,
  type DataPageObservationRow,
} from '@repo/domain/statistics/data-page-series';
import { fetchMaterializedSnapshot } from '../public-data/public-readers';
import { queryPostgres, resolvePostgresConnectionString } from '../public-data/postgres-client';

const DATA_PAGE_METRIC_IDS = [
  'scf-median-wealth-black-nation',
  'scf-median-wealth-white-nation',
  'imprisonment-rate-black-state',
  'imprisonment-rate-white-state',
  'nhgis-homeownership-rate-black-county',
  'nhgis-homeownership-rate-white-county',
  'hmda-denial-rate-black-county',
  'hmda-denial-rate-white-county',
  'ussc-average-sentence-months-crack-nation',
  'ussc-average-sentence-months-powder-nation',
  'hud-chas-cost-burden-black-county',
  'hud-chas-cost-burden-white-county',
] as const;

type ObservationQueryRow = {
  readonly metric_id: string;
  readonly jurisdiction_id: string;
  readonly reference_period: string;
  readonly estimate: number;
  readonly source: string;
  readonly source_url: string;
};

async function fetchDataPageObservations(): Promise<readonly DataPageObservationRow[]> {
  if (!resolvePostgresConnectionString()) {
    return [];
  }
  try {
    const rows = await queryPostgres<ObservationQueryRow>(
      `SELECT metric_id, jurisdiction_id, reference_period, estimate, source, source_url
       FROM bb_reference.statistical_observations
       WHERE metric_id = ANY($1::text[])
       ORDER BY reference_period, jurisdiction_id`,
      [[...DATA_PAGE_METRIC_IDS]],
    );
    return rows.map((row) => ({
      metricId: row.metric_id,
      jurisdictionId: row.jurisdiction_id,
      referencePeriod: row.reference_period,
      estimate: Number(row.estimate),
      source: row.source,
      sourceUrl: row.source_url,
    }));
  } catch {
    return [];
  }
}

export async function getDataPageIndicatorBundle(): Promise<DataPageIndicatorBundle> {
  if (resolvePostgresConnectionString()) {
    try {
      const snapshot = await fetchMaterializedSnapshot('dataPageIndicatorSeries');
      if (isDataPageIndicatorBundle(snapshot)) {
        return snapshot;
      }
    } catch {
      // Fall through to live observation query or fixture bundle.
    }
  }

  const observations = await fetchDataPageObservations();
  if (observations.length > 0) {
    return mergeDataPageIndicatorBundle(DATA_PAGE_INDICATOR_FIXTURE_BUNDLE, observations);
  }

  return DATA_PAGE_INDICATOR_FIXTURE_BUNDLE;
}

export type { DataPageIndicatorBundle };
