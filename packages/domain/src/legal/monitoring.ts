/**
 * Legal change monitoring core: compares adapter fixture snapshots against prior state hashes and
 * proposes deduped `review_queue` events. Automation proposes; humans dispose.
 */
import {
  dedupeReviewQueueEvents,
  type LegalReviewQueueEvent,
  type ReviewQueueConfidence,
  type ReviewQueueEventType,
} from './review-queue.js';
import type { LegalSnapshot, LegalTopic } from './types.js';

export type LegalMonitoringSourceSnapshot = {
  readonly source: string;
  readonly externalId: string;
  readonly jurisdiction: string;
  readonly title: string;
  readonly topics: readonly LegalTopic[];
  readonly changeHash: string;
  readonly sourceUrl: string;
  readonly officialUrl?: string;
  readonly archivedCaptureUrl: string;
  readonly diffHint?: string;
  readonly affectedSnapshotIds: readonly string[];
};

export type LegalMonitoringPriorState = {
  readonly source: string;
  readonly externalId: string;
  readonly changeHash: string;
};

export type ProposeLegalReviewEventsInput = {
  readonly detectedAt: string;
  readonly current: readonly LegalMonitoringSourceSnapshot[];
  readonly prior: readonly LegalMonitoringPriorState[];
  readonly eventTypeBySource?: Readonly<Partial<Record<string, ReviewQueueEventType>>>;
  readonly confidence?: ReviewQueueConfidence;
  readonly existingDedupeKeys?: ReadonlySet<string>;
};

const DEFAULT_EVENT_TYPE: ReviewQueueEventType = 'tracker_update';

function priorHashLookup(prior: readonly LegalMonitoringPriorState[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of prior) {
    map.set(`${row.source}:${row.externalId}`, row.changeHash);
  }
  return map;
}

function resolveEventType(
  source: string,
  eventTypeBySource: Readonly<Partial<Record<string, ReviewQueueEventType>>>,
): ReviewQueueEventType {
  return eventTypeBySource[source] ?? DEFAULT_EVENT_TYPE;
}

/**
 * Emits `pending_review` events when a monitored source's change hash differs from prior state.
 * Every event carries archived capture evidence events without a capture are dropped.
 */
export function proposeLegalReviewEvents(
  input: ProposeLegalReviewEventsInput,
): readonly LegalReviewQueueEvent[] {
  const priorMap = priorHashLookup(input.prior);
  const confidence = input.confidence ?? 'medium';
  const eventTypeBySource = input.eventTypeBySource ?? {};
  const proposed: LegalReviewQueueEvent[] = [];

  for (const row of input.current) {
    const key = `${row.source}:${row.externalId}`;
    const previousHash = priorMap.get(key);
    if (previousHash === row.changeHash) continue;
    if (!row.archivedCaptureUrl.trim()) continue;

    const eventType = resolveEventType(row.source, eventTypeBySource);
    proposed.push({
      source: row.source,
      eventType,
      jurisdiction: row.jurisdiction,
      topic: row.topics,
      externalId: row.externalId,
      title: row.title,
      summarySnippet: row.diffHint ?? `Change detected for ${row.title}`,
      detectedAt: input.detectedAt,
      evidence: {
        sourceUrl: row.sourceUrl,
        ...(row.officialUrl !== undefined ? { officialUrl: row.officialUrl } : {}),
        archivedCaptureUrl: row.archivedCaptureUrl,
        ...(previousHash !== undefined ? { changeHashPrev: previousHash } : {}),
        changeHashNew: row.changeHash,
        ...(row.diffHint !== undefined ? { diffHint: row.diffHint } : {}),
      },
      proposedAction: `Review ${row.title} and update affected legal snapshot entries if confirmed.`,
      affectedEntries: row.affectedSnapshotIds,
      confidence,
      status: 'pending_review',
    });
  }

  return dedupeReviewQueueEvents(proposed, input.existingDedupeKeys ?? new Set());
}

/** Maps curated snapshots to monitoring rows for adapter-driven diffing. */
export function snapshotsToMonitoringRows(
  snapshots: readonly LegalSnapshot[],
  source: string,
): readonly LegalMonitoringSourceSnapshot[] {
  return snapshots.flatMap((snapshot) =>
    snapshot.externalIds
      .filter((ext) => ext.source === source)
      .map((ext) => ({
        source: ext.source,
        externalId: ext.externalId,
        jurisdiction: snapshot.jurisdictionId,
        title: snapshot.title,
        topics: snapshot.topics,
        changeHash: snapshot.citation.archive.changeHash ?? snapshot.id,
        sourceUrl: snapshot.citation.archive.sourceUrl,
        ...(snapshot.citation.archive.officialUrl !== undefined
          ? { officialUrl: snapshot.citation.archive.officialUrl }
          : {}),
        archivedCaptureUrl: snapshot.citation.archive.archivedCaptureUrl,
        affectedSnapshotIds: [snapshot.id],
      })),
  );
}
