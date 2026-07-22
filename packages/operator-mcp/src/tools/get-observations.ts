/**
 * get_observations — fetch as-reported observations for a series with provenance.
 */
import {
  DEFAULT_OBSERVATION_LIMIT,
  MAX_OBSERVATION_LIMIT,
  OBSERVATIONS_DISCLAIMER,
} from '../constants.js';
import type { IndicatorDbReader } from '../db/types.js';
import { OperatorMcpError } from '../errors.js';
import { mapObservationRow } from '../mappers.js';
import type { GetObservationsInput, ObservationPayload } from '../types.js';
import { assertNoForbiddenCausalRequest } from './causal-guard.js';

function resolveLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_OBSERVATION_LIMIT;
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new OperatorMcpError('invalid_input', 'limit must be a positive integer');
  }
  return Math.min(limit, MAX_OBSERVATION_LIMIT);
}

export async function getObservations(
  reader: IndicatorDbReader,
  input: GetObservationsInput,
): Promise<{
  readonly observations: readonly ObservationPayload[];
  readonly disclaimer: string;
}> {
  assertNoForbiddenCausalRequest(input as unknown as Record<string, unknown>);

  const metricId = input.metricId?.trim();
  if (!metricId) {
    throw new OperatorMcpError('invalid_input', 'metricId is required');
  }

  const series = await reader.getSeries(metricId);
  const catalogFallback = !series;
  if (catalogFallback) {
    const { filterCatalogSeries } = await import('../mappers.js');
    if (filterCatalogSeries({ metricId }).length === 0) {
      throw new OperatorMcpError('unknown_metric', `Unknown metricId: ${metricId}`);
    }
  }

  if (input.jurisdictionId) {
    const exists = await reader.jurisdictionExists(input.jurisdictionId);
    if (!exists) {
      throw new OperatorMcpError(
        'unknown_jurisdiction',
        `Unknown jurisdictionId: ${input.jurisdictionId}`,
      );
    }
  }

  const rows = await reader.listObservations({
    metricId,
    ...(input.jurisdictionId !== undefined ? { jurisdictionId: input.jurisdictionId } : {}),
    ...(input.referencePeriod !== undefined ? { referencePeriod: input.referencePeriod } : {}),
    limit: resolveLimit(input.limit),
  });

  return {
    observations: rows.map(mapObservationRow),
    disclaimer: OBSERVATIONS_DISCLAIMER,
  };
}
