/**
 * Reddit pointer liveness re-checking. Two entry points:
 *
 * 1. `sweepRedditPointerLiveness` (`./deletion-sync.ts`) — the scheduled, batch liveness sweep
 * a cron job runs periodically.
 * 2. `assertPointerLiveBeforeReview` (this file) — a synchronous, single-pointer re-check that
 * MUST be awaited immediately before a pointer is attached to human review or a research
 * case. The scheduled sweep alone is not sufficient: up to one full sweep interval (6h,
 * see `packages/config/src/scheduled-jobs/roster.ts`) could have elapsed since the last
 * sweep, and Reddit/the author could have deleted the content in that window. This
 * function closes that gap by re-checking liveness at the moment of use, not on a timer.
 *
 * Both entry points share the same `RedditLivenessChecker` port so a caller only ever supplies
 * one liveness-checking implementation (test fixture or, once Reddit approval lands, a real
 * OAuth-backed one built on `checkRedditPostLivenessViaListingLookup` below).
 */
import type { SafeHttpClient } from '../internet-archive/shared/http-port.js';
import { buildRedditInfoUrl, isPostRemovedOrDeleted, parseRedditListingResponse } from './client.js';
import type { RedditStoredPointer } from './types.js';

export const REDDIT_LIVENESS_REASONS = [
  'live',
  'removed_by_moderator_or_admin',
  'deleted_by_author',
  'not_found',
] as const;

export type RedditLivenessReason = (typeof REDDIT_LIVENESS_REASONS)[number];

export type RedditLivenessCheckResult = {
  readonly pointerId: string;
  readonly checkedAt: string;
  readonly live: boolean;
  readonly reason: RedditLivenessReason;
};

/** The injection seam every liveness check (scheduled sweep or pre-review gate) goes through.
 * Structurally intended to be backed by a real OAuth-authenticated Reddit lookup in production
 * (see `checkRedditPostLivenessViaListingLookup`); tests inject a fixture-driven fake so the
 * automated suite never performs live network I/O. */
export type RedditLivenessChecker = (pointer: RedditStoredPointer) => Promise<RedditLivenessCheckResult>;

/**
 * Real, tested reference implementation of `RedditLivenessChecker`: looks the pointer's post up
 * via Reddit's `/api/info` OAuth endpoint (the same `Listing` envelope `/new` returns see
 * ./client.ts) and classifies liveness from the same two signals the discovery poll already
 * uses to skip already-gone posts (`removed_by_category`, `author === '[deleted]'`), plus a
 * missing-result case (an empty `Listing` means the post id no longer resolves at all). Requires
 * a caller-supplied, already-authenticated `SafeHttpClient` never calls `fetch` directly, and
 * never reads a bearer token from an environment variable (mirrors./fetch-listing.ts).
 */
export function checkRedditPostLivenessViaListingLookup(
  client: SafeHttpClient,
): RedditLivenessChecker {
  return async (pointer: RedditStoredPointer): Promise<RedditLivenessCheckResult> => {
    const fullname = `t3_${pointer.postId}`;
    const url = buildRedditInfoUrl([fullname]);
    const response = await client({ url, method: 'GET', allowedContentTypes: ['application/json', 'text/json'] });
    const raw = JSON.parse(response.bodyText) as unknown;
    const parsed = parseRedditListingResponse(raw);
    const checkedAt = new Date().toISOString();
    const post = parsed.posts[0];
    if (!post) {
      return { pointerId: pointer.id, checkedAt, live: false, reason: 'not_found' };
    }
    if (isPostRemovedOrDeleted(post)) {
      const reason: RedditLivenessReason = post.author === '[deleted]' ? 'deleted_by_author' : 'removed_by_moderator_or_admin';
      return { pointerId: pointer.id, checkedAt, live: false, reason };
    }
    return { pointerId: pointer.id, checkedAt, live: true, reason: 'live' };
  };
}

/**
 * Mandatory synchronous gate: MUST be called and awaited immediately before a Reddit pointer is
 * attached to human review or a research case. Throws when the
 * fresh check reports the content is no longer live, so a caller cannot accidentally attach
 * dead/removed content there is no code path that skips this and still attaches a pointer.
 */
export async function assertPointerLiveBeforeReview(
  pointer: RedditStoredPointer,
  checker: RedditLivenessChecker,
): Promise<RedditLivenessCheckResult> {
  const result = await checker(pointer);
  if (!result.live) {
    throw new Error(
      `Reddit pointer ${pointer.id} is no longer live (${result.reason}); refusing to attach it ` +
        'to human review or a research case without a fresh, passing liveness check ()',
    );
  }
  return result;
}
