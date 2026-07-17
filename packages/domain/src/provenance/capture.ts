/**
 * Source captures and retrieval events with parser versions and selective snapshots (BB-016).
 */
import type { ContentHash } from './hashes.js';
import { normalizeContentHash } from './hashes.js';
import type { SnapshotMode } from './source.js';
import { assertSnapshotIsSelective } from './source.js';

export const RETRIEVAL_STATUSES = [
  'success',
  'failure',
  'skipped_disabled',
  'skipped_duplicate',
] as const;

export type RetrievalStatus = (typeof RETRIEVAL_STATUSES)[number];

export type RetrievalEvent = {
  readonly id: string;
  readonly sourceId: string;
  readonly sourceItemId?: string;
  readonly adapterId: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly status: RetrievalStatus;
  readonly httpStatus?: number;
  readonly error?: string;
  readonly parserVersion?: string;
};

export type SourceCapture = {
  readonly id: string;
  readonly sourceItemId: string;
  readonly sourceId: string;
  readonly contentHash: ContentHash;
  readonly parserVersion: string;
  readonly retrievedAt: string;
  readonly retrievalEventId?: string;
  /** Present only when a selective snapshot was stored; never automatic. */
  readonly snapshotStorageObject?: string;
  readonly snapshotMode: SnapshotMode;
  /** When set, this capture was deduplicated against an existing hash. */
  readonly dedupOfCaptureId?: string;
  readonly createdAt: string;
};

export function assertCaptureHashValid(capture: Pick<SourceCapture, 'contentHash'>): void {
  normalizeContentHash(capture.contentHash);
}

export function assertSelectiveSnapshotPolicy(
  capture: Pick<SourceCapture, 'snapshotMode' | 'snapshotStorageObject'>,
): void {
  assertSnapshotIsSelective(capture.snapshotMode);
  if (capture.snapshotMode === 'none' && capture.snapshotStorageObject) {
    throw new Error('snapshotMode "none" cannot include snapshotStorageObject');
  }
}

/**
 * Build a capture record after hash dedup. Duplicates keep a pointer to the canonical capture
 * and must not store a second snapshot blob.
 */
export function buildCaptureAfterDedup(input: {
  readonly id: string;
  readonly sourceItemId: string;
  readonly sourceId: string;
  readonly contentHash: ContentHash;
  readonly parserVersion: string;
  readonly retrievedAt: string;
  readonly createdAt: string;
  readonly retrievalEventId?: string;
  readonly snapshotMode: SnapshotMode;
  readonly snapshotStorageObject?: string;
  readonly dedupOfCaptureId?: string;
}): SourceCapture {
  assertSnapshotIsSelective(input.snapshotMode);
  const contentHash = normalizeContentHash(input.contentHash);
  if (input.dedupOfCaptureId) {
    return {
      id: input.id,
      sourceItemId: input.sourceItemId,
      sourceId: input.sourceId,
      contentHash,
      parserVersion: input.parserVersion,
      retrievedAt: input.retrievedAt,
      ...(input.retrievalEventId ? { retrievalEventId: input.retrievalEventId } : {}),
      snapshotMode: 'none',
      dedupOfCaptureId: input.dedupOfCaptureId,
      createdAt: input.createdAt,
    };
  }
  const capture: SourceCapture = {
    id: input.id,
    sourceItemId: input.sourceItemId,
    sourceId: input.sourceId,
    contentHash,
    parserVersion: input.parserVersion,
    retrievedAt: input.retrievedAt,
    ...(input.retrievalEventId ? { retrievalEventId: input.retrievalEventId } : {}),
    snapshotMode: input.snapshotMode,
    ...(input.snapshotStorageObject ? { snapshotStorageObject: input.snapshotStorageObject } : {}),
    createdAt: input.createdAt,
  };
  assertSelectiveSnapshotPolicy(capture);
  return capture;
}
