/**
 * Cheap catalog blocking for discovery survivors.
 *
 * Uses the existing entity resolver to propose links to canonical entities already in the
 * catalog. Never merges silently and never publishes — outcomes are propose / review / no_match
 * attachments on private discovery candidates only.
 */
import {
  createDuplicateReviewQueueItem,
  resolveEntityCandidate,
  resolutionCandidateFromDiscovery,
  type DuplicateReviewQueueItem,
  type ResolutionContext,
  type ResolutionProfile,
  type ResolutionResult,
} from '../resolution/index.js';
import type { DiscoveryCandidateRecord, DiscoveryCatalogMatch } from './types.js';

export type { DiscoveryCatalogMatch };

export type CatalogMatchCatalog = {
  readonly profiles: readonly ResolutionProfile[];
  readonly context?: ResolutionContext;
};

export type AttachCatalogMatchResult = {
  readonly candidate: DiscoveryCandidateRecord;
  readonly resolution: ResolutionResult;
  readonly reviewItem?: DuplicateReviewQueueItem;
};

const TOP_MATCH_LIMIT = 3;

function toCatalogMatch(result: ResolutionResult, matchedAt: string): DiscoveryCatalogMatch {
  const topMatches = result.rankedMatches.slice(0, TOP_MATCH_LIMIT).map((match) => ({
    entityId: match.entityId,
    confidence: match.confidence,
  }));
  return {
    outcome: result.outcome,
    ...(result.selectedEntityId !== undefined ? { selectedEntityId: result.selectedEntityId } : {}),
    topMatches,
    rationale: result.rationale,
    matchedAt,
  };
}

/**
 * Score a discovery candidate against catalog profiles and attach the compact result.
 * Review-required outcomes also produce a DuplicateReviewQueueItem for human triage.
 */
export function attachCatalogMatch(
  candidate: DiscoveryCandidateRecord,
  catalog: CatalogMatchCatalog,
  matchedAt: string,
): AttachCatalogMatchResult {
  const resolutionCandidate = resolutionCandidateFromDiscovery(candidate);
  const resolution = resolveEntityCandidate(
    resolutionCandidate,
    catalog.profiles,
    catalog.context ?? {},
  );
  const next: DiscoveryCandidateRecord = {
    ...candidate,
    catalogMatch: toCatalogMatch(resolution, matchedAt),
    updatedAt: matchedAt,
  };

  if (resolution.outcome !== 'review_required') {
    return { candidate: next, resolution };
  }

  return {
    candidate: next,
    resolution,
    reviewItem: createDuplicateReviewQueueItem(resolutionCandidate, resolution, matchedAt),
  };
}

export type AttachCatalogMatchesResult = {
  readonly candidates: readonly DiscoveryCandidateRecord[];
  readonly reviewQueueItems: readonly DuplicateReviewQueueItem[];
  readonly proposedMatchCount: number;
  readonly reviewRequiredCount: number;
  readonly noMatchCount: number;
};

/** Attach catalog matches to accepted/merged survivors only; leave quarantine/dead-letter alone. */
export function attachCatalogMatchesToSurvivors(
  survivors: readonly DiscoveryCandidateRecord[],
  catalog: CatalogMatchCatalog,
  matchedAt: string,
): AttachCatalogMatchesResult {
  const candidates: DiscoveryCandidateRecord[] = [];
  const reviewQueueItems: DuplicateReviewQueueItem[] = [];
  let proposedMatchCount = 0;
  let reviewRequiredCount = 0;
  let noMatchCount = 0;

  for (const survivor of survivors) {
    if (survivor.status !== 'accepted' && survivor.status !== 'merged') {
      candidates.push(survivor);
      continue;
    }

    const attached = attachCatalogMatch(survivor, catalog, matchedAt);
    candidates.push(attached.candidate);
    if (attached.reviewItem) {
      reviewQueueItems.push(attached.reviewItem);
    }
    if (attached.resolution.outcome === 'proposed_match') proposedMatchCount += 1;
    else if (attached.resolution.outcome === 'review_required') reviewRequiredCount += 1;
    else noMatchCount += 1;
  }

  return {
    candidates,
    reviewQueueItems,
    proposedMatchCount,
    reviewRequiredCount,
    noMatchCount,
  };
}
