/**
 * `review_queue` event shape for legal change monitoring. Automation proposes events with
 * archived evidence; humans dispose. Dedupe key is `(source, externalId, changeHashNew)`.
 */
import type { LegalTopic } from './types.js';

export const REVIEW_QUEUE_EVENT_TYPES = [
  'bill_status_change',
  'became_law',
  'new_opinion',
  'reg_amended',
  'cfr_version',
  'tracker_update',
] as const;
export type ReviewQueueEventType = (typeof REVIEW_QUEUE_EVENT_TYPES)[number];

export const REVIEW_QUEUE_STATUSES = ['pending_review', 'accepted', 'dismissed'] as const;
export type ReviewQueueStatus = (typeof REVIEW_QUEUE_STATUSES)[number];

export const REVIEW_QUEUE_CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export type ReviewQueueConfidence = (typeof REVIEW_QUEUE_CONFIDENCE_LEVELS)[number];

export type ReviewQueueEvidence = {
  readonly sourceUrl: string;
  readonly officialUrl?: string;
  readonly archivedCaptureUrl: string;
  readonly changeHashPrev?: string;
  readonly changeHashNew?: string;
  readonly diffHint?: string;
};

/** Proposed change event landing in Firestore `review_queue`. */
export type LegalReviewQueueEvent = {
  readonly source: string;
  readonly eventType: ReviewQueueEventType;
  readonly jurisdiction: string;
  readonly topic: readonly LegalTopic[];
  readonly externalId: string;
  readonly title: string;
  readonly summarySnippet: string;
  readonly detectedAt: string;
  readonly evidence: ReviewQueueEvidence;
  readonly proposedAction: string;
  readonly affectedEntries: readonly string[];
  readonly confidence: ReviewQueueConfidence;
  readonly status: ReviewQueueStatus;
};

export function reviewQueueDedupeKey(event: Pick<LegalReviewQueueEvent, 'source' | 'externalId' | 'evidence'>): string {
  const hash = event.evidence.changeHashNew ?? '';
  return `${event.source}:${event.externalId}:${hash}`;
}

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function assertReviewQueueEvidenceValid(evidence: ReviewQueueEvidence): void {
  if (!isNonEmpty(evidence.sourceUrl)) {
    throw new Error('ReviewQueueEvidence.sourceUrl must be non-empty');
  }
  if (!isNonEmpty(evidence.archivedCaptureUrl)) {
    throw new Error('ReviewQueueEvidence.archivedCaptureUrl must be non-empty');
  }
}

export function assertLegalReviewQueueEventValid(event: LegalReviewQueueEvent): void {
  if (!isNonEmpty(event.source)) {
    throw new Error('LegalReviewQueueEvent.source must be non-empty');
  }
  if (!(REVIEW_QUEUE_EVENT_TYPES as readonly string[]).includes(event.eventType)) {
    throw new Error(`Unknown LegalReviewQueueEvent.eventType "${event.eventType}"`);
  }
  if (!isNonEmpty(event.externalId)) {
    throw new Error('LegalReviewQueueEvent.externalId must be non-empty');
  }
  if (!isNonEmpty(event.title)) {
    throw new Error('LegalReviewQueueEvent.title must be non-empty');
  }
  assertReviewQueueEvidenceValid(event.evidence);
  if (event.status === 'pending_review' && !isNonEmpty(event.evidence.archivedCaptureUrl)) {
    throw new Error('pending_review events require an archived capture before review');
  }
}

/** Returns events from `incoming` whose dedupe key is not already in `existingKeys`. */
export function dedupeReviewQueueEvents(
  incoming: readonly LegalReviewQueueEvent[],
  existingKeys: ReadonlySet<string>,
): readonly LegalReviewQueueEvent[] {
  const seen = new Set(existingKeys);
  const unique: LegalReviewQueueEvent[] = [];
  for (const event of incoming) {
    const key = reviewQueueDedupeKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(event);
  }
  return unique;
}
