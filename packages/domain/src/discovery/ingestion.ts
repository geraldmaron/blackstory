/**
 * Bulk and API candidate ingestion interfaces (BB-039).
 */
import {
  assertAdapterCandidateValid,
  validateAdapterCandidates,
  type AdapterCandidateRecord,
} from '../adapters/index.js';
import { buildCandidateIdentity } from './identity.js';
import { extractDiscoverySignals } from './signals.js';
import { extractGeographicHints } from './geography.js';
import {
  DISCOVERY_CANDIDATE_SCHEMA_VERSION,
  type ApiIngestRequest,
  type BulkIngestBatch,
  type DiscoveryCandidateRecord,
  type DiscoveryIngestMode,
} from './types.js';
import type { QueryPack } from '../query-packs/types.js';

export type IngestDiscoveryCandidateInput = {
  readonly record: AdapterCandidateRecord;
  readonly pack: QueryPack;
  readonly ingestMode: DiscoveryIngestMode;
  readonly candidateId: string;
  readonly now: string;
};

function buildDiscoveryCandidate(input: IngestDiscoveryCandidateInput): DiscoveryCandidateRecord {
  assertAdapterCandidateValid(input.record);
  return {
    schemaVersion: DISCOVERY_CANDIDATE_SCHEMA_VERSION,
    id: input.candidateId,
    identity: buildCandidateIdentity(input.record),
    adapterRecord: input.record,
    status: 'pending',
    ingestMode: input.ingestMode,
    signals: extractDiscoverySignals(input.record, input.pack),
    geographicHints: extractGeographicHints(input.record),
    retryCount: 0,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/** Bulk ingestion interface for adapter batch output. */
export function ingestBulkCandidates(
  batch: BulkIngestBatch,
  pack: QueryPack,
  options: { readonly now: string; readonly idPrefix?: string },
): readonly DiscoveryCandidateRecord[] {
  validateAdapterCandidates(batch.records);
  const mode = batch.ingestMode ?? 'bulk';
  const prefix = options.idPrefix ?? 'disc';

  return batch.records.map((record, index) =>
    buildDiscoveryCandidate({
      record,
      pack,
      ingestMode: mode,
      candidateId: `${prefix}_${index}_${record.stableIdentifier}`,
      now: options.now,
    }),
  );
}

/** API ingestion interface for single candidate records. */
export function ingestApiCandidate(
  request: ApiIngestRequest,
  pack: QueryPack,
  options: { readonly now: string; readonly candidateId?: string },
): DiscoveryCandidateRecord {
  return buildDiscoveryCandidate({
    record: request.record,
    pack,
    ingestMode: 'api',
    candidateId: options.candidateId ?? `disc_api_${request.record.stableIdentifier}`,
    now: options.now,
  });
}

export type BulkIngestInterface = typeof ingestBulkCandidates;
export type ApiIngestInterface = typeof ingestApiCandidate;
