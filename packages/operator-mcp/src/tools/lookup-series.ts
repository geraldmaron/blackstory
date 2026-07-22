/**
 * lookup_series — list or fetch metric definitions from Postgres with catalog fallback.
 */
import type { IndicatorDbReader } from '../db/types.js';
import { OperatorMcpError } from '../errors.js';
import { filterCatalogSeries, mapSeriesRow } from '../mappers.js';
import type { LookupSeriesInput, SeriesSummary } from '../types.js';

export async function lookupSeries(
  reader: IndicatorDbReader,
  input: LookupSeriesInput,
): Promise<{ readonly series: readonly SeriesSummary[] }> {
  const filters = {
    ...(input.metricId !== undefined ? { metricId: input.metricId } : {}),
    ...(input.theme !== undefined ? { theme: input.theme } : {}),
    ...(input.geographyType !== undefined ? { geographyType: input.geographyType } : {}),
  };

  const dbRows = await reader.listSeries(filters);
  if (dbRows.length > 0) {
    return { series: dbRows.map(mapSeriesRow) };
  }

  const catalogRows = filterCatalogSeries(filters);
  if (input.metricId && catalogRows.length === 0) {
    throw new OperatorMcpError('unknown_metric', `Unknown metricId: ${input.metricId}`);
  }

  return { series: catalogRows };
}
