/**
 * Client-side queue helpers for story packet human review:
 * filter, sort, search, and selection counts. Pure functions — no I/O.
 */

export const STORY_REVIEW_BULK_LIMIT = 50;

export type StoryReviewStatusFilter =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'needs_evidence'
  | 'all';

export type StoryPacketDecisionFilter = 'all' | 'recommend' | 'needs_evidence' | 'reject';

export type StoryReviewSortKey =
  | 'createdAt'
  | 'title'
  | 'packetDecision'
  | 'issueCount'
  | 'reviewStatus';

export type StoryReviewSortDirection = 'asc' | 'desc';

export type StoryReviewQueueItem = {
  readonly submissionId: string;
  readonly createdAt: string;
  readonly title: string;
  readonly decision: string;
  readonly topicId: string;
  readonly validationIssueCount: number;
  readonly review: { readonly decision: string } | null;
  readonly packet: {
    readonly draft: { readonly dek?: string; readonly placeLabel?: string; readonly eraLabel?: string };
    readonly rationale?: string;
    readonly topicTitle?: string;
  };
};

export type StoryReviewQueueQuery = {
  readonly reviewStatus: StoryReviewStatusFilter;
  readonly packetDecision: StoryPacketDecisionFilter;
  readonly issuesOnly: boolean;
  readonly search: string;
  readonly sortKey: StoryReviewSortKey;
  readonly sortDirection: StoryReviewSortDirection;
};

export type StoryReviewQueueCounts = {
  readonly total: number;
  readonly pending: number;
  readonly approved: number;
  readonly rejected: number;
  readonly needsEvidence: number;
  readonly withIssues: number;
};

export const DEFAULT_STORY_REVIEW_QUERY: StoryReviewQueueQuery = {
  reviewStatus: 'pending',
  packetDecision: 'all',
  issuesOnly: false,
  search: '',
  sortKey: 'createdAt',
  sortDirection: 'desc',
};

function reviewStatusOf(item: StoryReviewQueueItem): StoryReviewStatusFilter {
  if (!item.review) return 'pending';
  if (item.review.decision === 'approved') return 'approved';
  if (item.review.decision === 'rejected') return 'rejected';
  if (item.review.decision === 'needs_evidence') return 'needs_evidence';
  return 'pending';
}

function matchesSearch(item: StoryReviewQueueItem, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    item.title,
    item.submissionId,
    item.topicId,
    item.packet.topicTitle ?? '',
    item.packet.draft.dek ?? '',
    item.packet.draft.placeLabel ?? '',
    item.packet.draft.eraLabel ?? '',
    item.packet.rationale ?? '',
    item.decision,
    item.review?.decision ?? 'pending',
  ]
    .join('\n')
    .toLowerCase();
  return haystack.includes(q);
}

export function countStoryReviewQueue(
  items: readonly StoryReviewQueueItem[],
): StoryReviewQueueCounts {
  let pending = 0;
  let approved = 0;
  let rejected = 0;
  let needsEvidence = 0;
  let withIssues = 0;
  for (const item of items) {
    const status = reviewStatusOf(item);
    if (status === 'pending') pending += 1;
    if (status === 'approved') approved += 1;
    if (status === 'rejected') rejected += 1;
    if (status === 'needs_evidence') needsEvidence += 1;
    if (item.validationIssueCount > 0) withIssues += 1;
  }
  return {
    total: items.length,
    pending,
    approved,
    rejected,
    needsEvidence,
    withIssues,
  };
}

export function filterStoryReviewQueue<T extends StoryReviewQueueItem>(
  items: readonly T[],
  query: StoryReviewQueueQuery,
): readonly T[] {
  return items.filter((item) => {
    const status = reviewStatusOf(item);
    if (query.reviewStatus !== 'all' && status !== query.reviewStatus) return false;
    if (query.packetDecision !== 'all' && item.decision !== query.packetDecision) return false;
    if (query.issuesOnly && item.validationIssueCount <= 0) return false;
    if (!matchesSearch(item, query.search)) return false;
    return true;
  });
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export function sortStoryReviewQueue<T extends StoryReviewQueueItem>(
  items: readonly T[],
  query: Pick<StoryReviewQueueQuery, 'sortKey' | 'sortDirection'>,
): readonly T[] {
  const direction = query.sortDirection === 'asc' ? 1 : -1;
  const sorted = [...items].sort((left, right) => {
    let cmp = 0;
    switch (query.sortKey) {
      case 'title':
        cmp = compareStrings(left.title, right.title);
        break;
      case 'packetDecision':
        cmp = compareStrings(left.decision, right.decision);
        break;
      case 'issueCount':
        cmp = left.validationIssueCount - right.validationIssueCount;
        break;
      case 'reviewStatus':
        cmp = compareStrings(reviewStatusOf(left), reviewStatusOf(right));
        break;
      case 'createdAt':
      default:
        cmp = compareStrings(left.createdAt, right.createdAt);
        break;
    }
    if (cmp === 0) cmp = compareStrings(left.submissionId, right.submissionId);
    return cmp * direction;
  });
  return Object.freeze(sorted);
}

export function applyStoryReviewQueue<T extends StoryReviewQueueItem>(
  items: readonly T[],
  query: StoryReviewQueueQuery,
): readonly T[] {
  return sortStoryReviewQueue(filterStoryReviewQueue(items, query), query);
}

export function assertStoryBulkSelection(
  submissionIds: readonly string[],
  limit = STORY_REVIEW_BULK_LIMIT,
): readonly string[] {
  if (submissionIds.length === 0) {
    throw new Error('Select at least one packet for bulk review');
  }
  if (submissionIds.length > limit) {
    throw new Error(`Bulk review is limited to ${limit} packets`);
  }
  if (new Set(submissionIds).size !== submissionIds.length) {
    throw new Error('Bulk review cannot include duplicate packet ids');
  }
  return submissionIds;
}
