/**
 * Read-only Postgres access for bb_reference statistical tables (operator/research).
 */

export type SeriesRow = {
  readonly metric_id: string;
  readonly metric_definition: string;
  readonly universe: string;
  readonly unit: string;
  readonly source_dataset: string;
  readonly source_table: string;
  readonly source_variable: string;
  readonly geography_type: string;
  readonly estimate_type: string;
  readonly period_type: string;
  readonly external_data_source_id: string | null;
  readonly theme: string | null;
};

export type ObservationRow = {
  readonly id: string;
  readonly metric_id: string;
  readonly jurisdiction_id: string;
  readonly boundary_version: string;
  readonly reference_period: string;
  readonly dataset_vintage: string;
  readonly estimate: number;
  readonly margin_of_error: number | null;
  readonly status: string;
  readonly source: string;
  readonly source_url: string;
  readonly retrieved_at: Date | string;
  readonly content_hash: string;
};

export type EntityBindingRow = {
  readonly id: string;
  readonly entity_id: string;
  readonly metric_id: string;
  readonly purpose: string;
  readonly jurisdiction_id: string | null;
  readonly notes: string;
};

export type ListSeriesFilters = {
  readonly metricId?: string;
  readonly theme?: string;
  readonly geographyType?: string;
};

export type ListObservationsFilters = {
  readonly metricId: string;
  readonly jurisdictionId?: string;
  readonly referencePeriod?: string;
  readonly limit: number;
};

export type ResolveObservationFilters = {
  readonly metricId: string;
  readonly jurisdictionId: string | null;
  readonly referencePeriod?: string;
};

export interface IndicatorDbReader {
  listSeries(filters: ListSeriesFilters): Promise<readonly SeriesRow[]>;
  getSeries(metricId: string): Promise<SeriesRow | null>;
  jurisdictionExists(jurisdictionId: string): Promise<boolean>;
  listObservations(filters: ListObservationsFilters): Promise<readonly ObservationRow[]>;
  resolveObservation(filters: ResolveObservationFilters): Promise<ObservationRow | null>;
  listEntityBindings(
    entityId: string,
    purpose?: string,
  ): Promise<readonly EntityBindingRow[]>;
}
