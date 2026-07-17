/**
 * Query-pack effectiveness metrics: record and aggregate helpers.
 */
import type {
  QueryPackEffectivenessMetrics,
  QueryPackEffectivenessRecord,
  QueryPackVersionId,
} from './types.js';

export type EffectivenessMetricStore = {
  readonly records: QueryPackEffectivenessRecord[];
};

export function createInMemoryEffectivenessStore(): EffectivenessMetricStore {
  return { records: [] };
}

export type RecordEffectivenessInput = {
  readonly packId: string;
  readonly versionId: QueryPackVersionId;
  readonly runId: string;
  readonly recordedAt: string;
  readonly queriesExecuted: number;
  readonly matchesObserved: number;
  readonly exclusionsObserved: number;
  readonly falsePositiveObserved: number;
};

export function recordQueryPackMetric(
  store: EffectivenessMetricStore,
  input: RecordEffectivenessInput,
): QueryPackEffectivenessRecord {
  if (input.queriesExecuted < 0 || input.matchesObserved < 0) {
    throw new Error('Effectiveness counts must be non-negative');
  }
  if (input.exclusionsObserved < 0 || input.falsePositiveObserved < 0) {
    throw new Error('Effectiveness counts must be non-negative');
  }

  const record: QueryPackEffectivenessRecord = {
    packId: input.packId,
    versionId: input.versionId,
    runId: input.runId,
    recordedAt: input.recordedAt,
    queriesExecuted: input.queriesExecuted,
    matchesObserved: input.matchesObserved,
    exclusionsObserved: input.exclusionsObserved,
    falsePositiveObserved: input.falsePositiveObserved,
  };
  store.records.push(record);
  return record;
}

export type ComputeEffectivenessInput = {
  readonly packId: string;
  readonly versionId: QueryPackVersionId;
  readonly records: readonly QueryPackEffectivenessRecord[];
};

function sumField(
  records: readonly QueryPackEffectivenessRecord[],
  field: keyof Pick<
    QueryPackEffectivenessRecord,
    'queriesExecuted' | 'matchesObserved' | 'exclusionsObserved' | 'falsePositiveObserved'
  >,
): number {
  return records.reduce((total, record) => total + record[field], 0);
}

export function computeEffectivenessMetrics(
  input: ComputeEffectivenessInput,
): QueryPackEffectivenessMetrics {
  const scoped = input.records.filter(
    (record) => record.packId === input.packId && record.versionId === input.versionId,
  );

  const totalQueries = sumField(scoped, 'queriesExecuted');
  const totalMatches = sumField(scoped, 'matchesObserved');
  const totalExclusions = sumField(scoped, 'exclusionsObserved');
  const totalFalsePositives = sumField(scoped, 'falsePositiveObserved');

  const matchRate = totalQueries === 0 ? 0 : totalMatches / totalQueries;
  const exclusionRate = totalMatches === 0 ? 0 : totalExclusions / totalMatches;
  const falsePositiveRate = totalMatches === 0 ? 0 : totalFalsePositives / totalMatches;

  const effectivenessScore =
    totalMatches === 0
      ? 0
      : Math.max(0, matchRate - falsePositiveRate - exclusionRate * 0.25);

  return {
    packId: input.packId,
    versionId: input.versionId,
    recordCount: scoped.length,
    totalQueries,
    totalMatches,
    totalExclusions,
    totalFalsePositives,
    matchRate,
    exclusionRate,
    falsePositiveRate,
    effectivenessScore,
  };
}

export function listEffectivenessRecords(
  store: EffectivenessMetricStore,
  packId: string,
  versionId?: QueryPackVersionId,
): readonly QueryPackEffectivenessRecord[] {
  return store.records.filter(
    (record) => record.packId === packId && (versionId === undefined || record.versionId === versionId),
  );
}
