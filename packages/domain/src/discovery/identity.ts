/**
 * Candidate identity and source reference helpers.
 */
import type { AdapterCandidateRecord } from '../adapters/types.js';
import { hashUtf8, type ContentHash } from '../provenance/hashes.js';
import { hashCandidateContent } from './hashing.js';
import type { DiscoveryCandidateIdentity, SourceReference } from './types.js';

export function buildSourceReference(record: AdapterCandidateRecord): SourceReference {
  return {
    sourceId: record.provenance.sourceId,
    adapterId: record.provenance.adapterId,
    parserVersion: record.provenance.parserVersion,
    registryEntryId: record.provenance.registryEntryId,
    runId: record.provenance.runId,
    capturedAt: record.provenance.capturedAt,
    ...(record.provenance.sourceItemId !== undefined
      ? { sourceItemId: record.provenance.sourceItemId }
      : {}),
    stableIdentifier: record.stableIdentifier,
  };
}

export function candidateIdentityKey(stableIdentifier: string, contentHash: ContentHash): string {
  const material = `${stableIdentifier.trim()}::${contentHash.algorithm}:${contentHash.digest}`;
  return hashUtf8(material).digest.slice(0, 32);
}

export function buildCandidateIdentity(record: AdapterCandidateRecord): DiscoveryCandidateIdentity {
  const contentHash = hashCandidateContent(record);
  return {
    identityKey: candidateIdentityKey(record.stableIdentifier, contentHash),
    stableIdentifier: record.stableIdentifier,
    contentHash,
    sourceReferences: [buildSourceReference(record)],
  };
}
