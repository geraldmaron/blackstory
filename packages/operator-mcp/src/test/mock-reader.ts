/**
 * In-memory IndicatorDbReader for unit tests.
 */
import type {
  EntityBindingRow,
  IndicatorDbReader,
  ListObservationsFilters,
  ListSeriesFilters,
  ObservationRow,
  ResolveObservationFilters,
  SeriesRow,
} from '../db/types.js';

export type MockIndicatorDbState = {
  readonly series: readonly SeriesRow[];
  readonly observations: readonly ObservationRow[];
  readonly bindings: readonly EntityBindingRow[];
  readonly jurisdictions: readonly string[];
};

export function createMockIndicatorDbReader(
  state: MockIndicatorDbState,
): IndicatorDbReader {
  return {
    async listSeries(filters: ListSeriesFilters): Promise<readonly SeriesRow[]> {
      return state.series.filter((row) => {
        if (filters.metricId && row.metric_id !== filters.metricId) return false;
        if (filters.theme && row.theme !== filters.theme) return false;
        if (filters.geographyType && row.geography_type !== filters.geographyType) return false;
        return true;
      });
    },

    async getSeries(metricId: string): Promise<SeriesRow | null> {
      return state.series.find((row) => row.metric_id === metricId) ?? null;
    },

    async jurisdictionExists(jurisdictionId: string): Promise<boolean> {
      return state.jurisdictions.includes(jurisdictionId);
    },

    async listObservations(filters: ListObservationsFilters): Promise<readonly ObservationRow[]> {
      const rows = state.observations.filter((row) => {
        if (row.metric_id !== filters.metricId) return false;
        if (filters.jurisdictionId && row.jurisdiction_id !== filters.jurisdictionId) return false;
        if (filters.referencePeriod && row.reference_period !== filters.referencePeriod) {
          return false;
        }
        return true;
      });
      return rows.slice(0, filters.limit);
    },

    async resolveObservation(filters: ResolveObservationFilters): Promise<ObservationRow | null> {
      if (!filters.jurisdictionId) return null;
      const rows = await this.listObservations({
        metricId: filters.metricId,
        jurisdictionId: filters.jurisdictionId,
        ...(filters.referencePeriod !== undefined ? { referencePeriod: filters.referencePeriod } : {}),
        limit: 1,
      });
      return rows[0] ?? null;
    },

    async listEntityBindings(
      entityId: string,
      purpose?: string,
    ): Promise<readonly EntityBindingRow[]> {
      return state.bindings.filter((row) => {
        if (row.entity_id !== entityId) return false;
        if (purpose && row.purpose !== purpose) return false;
        return true;
      });
    },
  };
}

export const SAMPLE_SERIES: SeriesRow = {
  metric_id: 'imprisonment-rate-black-state',
  metric_definition: 'Imprisonment rate for Black residents',
  universe: 'residents',
  unit: 'per 100k',
  source_dataset: 'BJS NPS',
  source_table: 'Table 9',
  source_variable: 'rate_black',
  geography_type: 'state',
  estimate_type: 'rate',
  period_type: 'annual',
  external_data_source_id: 'bjs-national-prisoner-statistics',
  theme: 'justice',
};

export const SAMPLE_OBSERVATION: ObservationRow = {
  id: 'obs:imprisonment-rate-black-state:state:24:2022',
  metric_id: 'imprisonment-rate-black-state',
  jurisdiction_id: 'state:24',
  boundary_version: 'state-2020',
  reference_period: '2022',
  dataset_vintage: 'BJS NPS 2022',
  estimate: 912,
  margin_of_error: null,
  status: 'observed',
  source: 'bjs-national-prisoner-statistics',
  source_url: 'https://bjs.ojp.gov/',
  retrieved_at: '2026-07-21T00:00:00.000Z',
  content_hash: 'abc123',
};

export const SAMPLE_BINDING: EntityBindingRow = {
  id: 'bind:demo',
  entity_id: 'topic:criminal-justice',
  metric_id: 'imprisonment-rate-black-state',
  purpose: 'mcp',
  jurisdiction_id: 'state:24',
  notes: 'State imprisonment context for the era — not a causal claim.',
};
