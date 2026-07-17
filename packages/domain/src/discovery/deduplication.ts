/**
 * Discovery candidate deduplication — merge duplicates without losing provenance (BB-039).
 */
import { contentHashesEqual } from '../provenance/hashes.js';
import type { DiscoveryCandidateIdentity, DiscoveryCandidateRecord, SourceReference } from './types.js';

function uniqueSourceReferences(
  references: readonly SourceReference[],
): readonly SourceReference[] {
  const seen = new Set<string>();
  const merged: SourceReference[] = [];
  for (const ref of references) {
    const key = [
      ref.sourceId,
      ref.adapterId,
      ref.stableIdentifier,
      ref.runId,
      ref.capturedAt,
    ].join('::');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(ref);
  }
  return merged;
}

export type MergeDuplicateCandidatesResult = {
  readonly survivors: readonly DiscoveryCandidateRecord[];
  readonly mergedCount: number;
};

/**
 * Merge duplicate candidates by content hash or identity key.
 * Provenance from absorbed records is accumulated on the survivor.
 */
export function mergeDuplicateCandidates(
  candidates: readonly DiscoveryCandidateRecord[],
): MergeDuplicateCandidatesResult {
  const byHash = new Map<string, DiscoveryCandidateRecord>();

  for (const candidate of candidates) {
    const hashKey = candidate.identity.contentHash.digest;
    const existing = byHash.get(hashKey);

    if (!existing) {
      byHash.set(hashKey, candidate);
      continue;
    }

    const mergedReferences = uniqueSourceReferences([
      ...existing.identity.sourceReferences,
      ...candidate.identity.sourceReferences,
    ]);

    const survivor: DiscoveryCandidateRecord = {
      ...existing,
      status: existing.status === 'accepted' ? 'accepted' : candidate.status,
      identity: {
        ...existing.identity,
        sourceReferences: mergedReferences,
      },
      updatedAt: candidate.updatedAt,
    };

    byHash.set(hashKey, survivor);
  }

  const survivors: DiscoveryCandidateRecord[] = [];
  let mergedCount = 0;

  for (const candidate of byHash.values()) {
    if (candidate.identity.sourceReferences.length > 1) {
      mergedCount += candidate.identity.sourceReferences.length - 1;
      survivors.push({
        ...candidate,
        status: 'merged',
      });
    } else {
      survivors.push(candidate);
    }
  }

  return { survivors, mergedCount };
}

export function areDuplicateCandidates(
  left: DiscoveryCandidateRecord,
  right: DiscoveryCandidateRecord,
): boolean {
  if (left.identity.identityKey === right.identity.identityKey) {
    return true;
  }
  return contentHashesEqual(left.identity.contentHash, right.identity.contentHash);
}

export function deduplicateByContentHash(
  candidates: readonly DiscoveryCandidateRecord[],
): readonly DiscoveryCandidateRecord[] {
  return mergeDuplicateCandidates(candidates).survivors;
}
