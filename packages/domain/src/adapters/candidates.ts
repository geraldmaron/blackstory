/**
 * Adapter candidate validation and provenance stamping.
 */
import type {
  AdapterCandidateProvenance,
  AdapterCandidateRecord,
  SourceRegistryEntry,
} from './types.js';

export const ADAPTER_CANDIDATE_SCHEMA_VERSION = 'candidate-record.v1' as const;

export type ValidateCandidateOptions = {
  readonly expectedSchemaVersion?: string;
};

export function assertCandidateHasProvenance(
  candidate: Pick<AdapterCandidateRecord, 'provenance'>,
): void {
  const { provenance } = candidate;
  if (!provenance.sourceId.trim()) {
    throw new Error('Candidate provenance.sourceId is required');
  }
  if (!provenance.adapterId.trim()) {
    throw new Error('Candidate provenance.adapterId is required');
  }
  if (!provenance.parserVersion.trim()) {
    throw new Error('Candidate provenance.parserVersion is required');
  }
  if (!provenance.registryEntryId.trim()) {
    throw new Error('Candidate provenance.registryEntryId is required');
  }
  if (!provenance.runId.trim()) {
    throw new Error('Candidate provenance.runId is required');
  }
  if (!provenance.capturedAt.trim()) {
    throw new Error('Candidate provenance.capturedAt is required');
  }
  if (!provenance.schemaVersion.trim()) {
    throw new Error('Candidate provenance.schemaVersion is required');
  }
}

export function assertAdapterCandidateValid(
  candidate: AdapterCandidateRecord,
  options: ValidateCandidateOptions = {},
): void {
  if (!candidate.stableIdentifier.trim()) {
    throw new Error('Candidate stableIdentifier is required');
  }
  assertCandidateHasProvenance(candidate);
  const expectedVersion = options.expectedSchemaVersion ?? ADAPTER_CANDIDATE_SCHEMA_VERSION;
  if (candidate.provenance.schemaVersion !== expectedVersion) {
    throw new Error(
      `Candidate schema version mismatch: expected ${expectedVersion}, got ${candidate.provenance.schemaVersion}`,
    );
  }
  if (candidate.canonicalUrl) {
    try {
      new URL(candidate.canonicalUrl);
    } catch {
      throw new Error(`Candidate canonicalUrl is not a valid URL: ${candidate.canonicalUrl}`);
    }
  }
}

export function validateAdapterCandidates(
  candidates: readonly AdapterCandidateRecord[],
  options: ValidateCandidateOptions = {},
): void {
  for (const candidate of candidates) {
    assertAdapterCandidateValid(candidate, options);
  }
}

export function stampCandidateProvenance(
  entry: SourceRegistryEntry,
  runId: string,
  capturedAt: string,
  partial: Omit<AdapterCandidateRecord, 'provenance'>,
): AdapterCandidateRecord {
  const provenance: AdapterCandidateProvenance = {
    sourceId: entry.evidenceSource.id,
    adapterId: entry.contract.adapterId,
    parserVersion: entry.contract.parserVersion,
    registryEntryId: entry.id,
    runId,
    capturedAt,
    schemaVersion: entry.contract.expectedSchemaVersion,
  };
  const candidate: AdapterCandidateRecord = {
    ...partial,
    provenance,
  };
  assertAdapterCandidateValid(candidate);
  return candidate;
}

/** Parse fixture JSON into candidate records (fixture-based parser tests). */
export function parseCandidateFixture(raw: unknown): AdapterCandidateRecord {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Candidate fixture must be an object');
  }
  const record = raw as AdapterCandidateRecord;
  assertAdapterCandidateValid(record);
  return record;
}

export function parseCandidateFixtureBatch(raw: unknown): readonly AdapterCandidateRecord[] {
  if (!Array.isArray(raw)) {
    throw new Error('Candidate fixture batch must be an array');
  }
  return raw.map((item) => parseCandidateFixture(item));
}
