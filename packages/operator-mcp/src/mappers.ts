/**
 * Map Postgres rows and catalog definitions to operator MCP contract payloads.
 */
import { assertPublishedStatisticProvenance } from '@repo/domain';
import {
  PHASE1_INDICATOR_CATALOG,
  type Phase1IndicatorDefinition,
} from '@repo/domain/statistics/phase1-indicator-catalog';
import type { ObservationRow, SeriesRow } from './db/types.js';
import type { EntityContextBinding, ObservationPayload, SeriesSummary } from './types.js';

export function mapSeriesRow(row: SeriesRow): SeriesSummary {
  return {
    metricId: row.metric_id,
    metricDefinition: row.metric_definition,
    universe: row.universe,
    unit: row.unit,
    sourceDataset: row.source_dataset,
    sourceTable: row.source_table,
    sourceVariable: row.source_variable,
    geographyType: row.geography_type,
    estimateType: row.estimate_type,
    periodType: row.period_type,
    externalDataSourceId: row.external_data_source_id,
    ...(row.theme ? { theme: row.theme } : {}),
  };
}

export function mapCatalogSeries(row: Phase1IndicatorDefinition): SeriesSummary {
  return {
    metricId: row.metricId,
    metricDefinition: row.metricDefinition,
    universe: row.universe,
    unit: row.unit,
    sourceDataset: row.sourceDataset,
    sourceTable: row.sourceTable,
    sourceVariable: row.sourceVariable,
    geographyType: row.geographyType,
    estimateType: row.estimateType,
    periodType: row.periodType,
    externalDataSourceId: row.externalDataSourceId,
    theme: row.theme,
  };
}

export function filterCatalogSeries(filters: {
  readonly metricId?: string;
  readonly theme?: string;
  readonly geographyType?: string;
}): readonly SeriesSummary[] {
  let rows = PHASE1_INDICATOR_CATALOG;
  if (filters.metricId) {
    rows = rows.filter((row) => row.metricId === filters.metricId);
  }
  if (filters.theme) {
    rows = rows.filter((row) => row.theme === filters.theme);
  }
  if (filters.geographyType) {
    rows = rows.filter((row) => row.geographyType === filters.geographyType);
  }
  return rows.map(mapCatalogSeries);
}

function toIsoTimestamp(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toISOString();
}

export function mapObservationRow(row: ObservationRow): ObservationPayload {
  assertPublishedStatisticProvenance({
    source: row.source,
    sourceUrl: row.source_url,
    retrievedAt: toIsoTimestamp(row.retrieved_at),
    contentHash: row.content_hash,
  });

  return {
    id: row.id,
    metricId: row.metric_id,
    jurisdictionId: row.jurisdiction_id,
    boundaryVersion: row.boundary_version,
    referencePeriod: row.reference_period,
    datasetVintage: row.dataset_vintage,
    estimate: row.estimate,
    marginOfError: row.margin_of_error,
    status: 'observed',
    provenance: {
      source: row.source,
      sourceUrl: row.source_url,
      retrievedAt: toIsoTimestamp(row.retrieved_at),
      contentHash: row.content_hash,
    },
  };
}

export function mapEntityBinding(
  binding: {
    readonly metric_id: string;
    readonly purpose: string;
    readonly jurisdiction_id: string | null;
    readonly notes: string;
  },
  observation: ObservationRow | null,
): EntityContextBinding {
  return {
    metricId: binding.metric_id,
    purpose: binding.purpose,
    jurisdictionId: binding.jurisdiction_id,
    notes: binding.notes,
    observation: observation ? mapObservationRow(observation) : null,
  };
}
