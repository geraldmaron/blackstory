/**
 * Parser drift metrics: types and recording helpers.
 */
import type { EvaluateRunHealthInput, EvaluateRunHealthResult } from './run-health.js';

export type ParserDriftMetric = {
  readonly adapterId: string;
  readonly parserVersion: string;
  readonly registryEntryId: string;
  readonly runId: string;
  readonly recordedAt: string;
  readonly expectedRecordCount: number;
  readonly actualRecordCount: number;
  readonly expectedSchemaVersion: string;
  readonly observedSchemaVersion: string;
  readonly fieldNullRates: Readonly<Record<string, number>>;
  readonly issues: readonly string[];
};

export type DriftAccumulator = {
  readonly adapterId: string;
  readonly parserVersion: string;
  readonly registryEntryId: string;
  readonly runId: string;
  readonly startedAt: string;
  fieldNullCounts: Record<string, { nulls: number; total: number }>;
};

export function createDriftAccumulator(input: {
  readonly adapterId: string;
  readonly parserVersion: string;
  readonly registryEntryId: string;
  readonly runId: string;
  readonly startedAt: string;
}): DriftAccumulator {
  return {
    ...input,
    fieldNullCounts: {},
  };
}

export function recordFieldObservation(
  accumulator: DriftAccumulator,
  field: string,
  isNull: boolean,
): void {
  const current = accumulator.fieldNullCounts[field] ?? { nulls: 0, total: 0 };
  accumulator.fieldNullCounts[field] = {
    nulls: current.nulls + (isNull ? 1 : 0),
    total: current.total + 1,
  };
}

export function computeFieldNullRates(
  accumulator: DriftAccumulator,
): Readonly<Record<string, number>> {
  const rates: Record<string, number> = {};
  for (const [field, counts] of Object.entries(accumulator.fieldNullCounts)) {
    rates[field] = counts.total === 0 ? 0 : counts.nulls / counts.total;
  }
  return rates;
}

export function buildParserDriftMetric(
  accumulator: DriftAccumulator,
  input: EvaluateRunHealthInput,
  health: EvaluateRunHealthResult,
  recordedAt: string,
): ParserDriftMetric {
  return {
    adapterId: accumulator.adapterId,
    parserVersion: accumulator.parserVersion,
    registryEntryId: accumulator.registryEntryId,
    runId: accumulator.runId,
    recordedAt,
    expectedRecordCount: input.expectedCount,
    actualRecordCount: input.actualCount,
    expectedSchemaVersion: input.expectedSchemaVersion,
    observedSchemaVersion: input.observedSchemaVersion,
    fieldNullRates: computeFieldNullRates(accumulator),
    issues: health.details,
  };
}

export type DriftMetricStore = {
  list(adapterId?: string): readonly ParserDriftMetric[];
  record(metric: ParserDriftMetric): void;
};

export function createInMemoryDriftMetricStore(
  seed: readonly ParserDriftMetric[] = [],
): DriftMetricStore {
  const metrics: ParserDriftMetric[] = [...seed];
  return {
    list(adapterId?: string) {
      if (!adapterId) {
        return metrics;
      }
      return metrics.filter((metric) => metric.adapterId === adapterId);
    },
    record(metric: ParserDriftMetric) {
      metrics.push(metric);
    },
  };
}
