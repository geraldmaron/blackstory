/**
 * Polling-cadence math for ("polling adapter respects the 100 QPM
 * free tier"). Pure arithmetic no I/O so reddit.test.ts can assert the curated subreddit
 * list + cadence design actually stays under Reddit's ceiling, not just document it in a
 * comment.
 */
import { REDDIT_LISTING_MAX_ITEMS, REDDIT_LISTING_MAX_PAGE_SIZE } from './types.js';

export type RateLimitDesignInput = {
  readonly subredditCount: number;
  readonly cadenceMinutes: number;
  /** Defaults to the worst case: every subreddit returns a full 1000-item backlog every cycle,
   * requiring the maximum number of 100-item pages to walk it. Real curated subreddits post far
   * less frequently this is a deliberately pessimistic upper bound, not an expected value. */
  readonly maxPagesPerSubredditPerCycle?: number;
};

export function worstCaseMaxPagesPerCycle(): number {
  return Math.ceil(REDDIT_LISTING_MAX_ITEMS / REDDIT_LISTING_MAX_PAGE_SIZE);
}

/**
 * Worst-case average requests/minute this adapter's poll design would issue: every curated
 * subreddit's listing fully paginated (see `worstCaseMaxPagesPerCycle`) once per cadence window.
 */
export function estimateWorstCaseRequestsPerMinute(input: RateLimitDesignInput): number {
  if (input.subredditCount <= 0 || input.cadenceMinutes <= 0) {
    throw new Error('subredditCount and cadenceMinutes must be positive');
  }
  const maxPages = input.maxPagesPerSubredditPerCycle ?? worstCaseMaxPagesPerCycle();
  const requestsPerCycle = input.subredditCount * maxPages;
  return requestsPerCycle / input.cadenceMinutes;
}
