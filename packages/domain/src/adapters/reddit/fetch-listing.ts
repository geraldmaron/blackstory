/**
 * Polls a curated subreddit's `/new` listing through the safe-HTTP port. Never
 * calls `fetch` directly see ../internet-archive/shared/http-port.ts for why this repo uses a
 * dependency-injected `SafeHttpClient` port instead. Production wiring (outside this package)
 * must implement `SafeHttpClient` with the real primitives AND attach a valid Reddit
 * OAuth bearer token via `SafeHttpRequest.headers.Authorization` that token only exists once
 * the HUMAN STEP (Responsible Builder application, see ./contract.ts) is approved and
 * credentials are provisioned. Every test in reddit.test.ts injects a mock client; zero live
 * network calls happen anywhere in this adapter or its tests.
 *
 * Pagination honors Reddit's own structural caps (../../adapters/reddit/types.ts
 * REDDIT_LISTING_MAX_ITEMS REDDIT_LISTING_MAX_PAGE_SIZE): walks the `after` cursor up to a
 * 1000-item ceiling, 100 items per request, and stops early once a page is short or has no
 * further cursor.
 */
import {
  assertAllowedContentType,
  defaultIsRetryable,
  mapWithConcurrency,
  withRetry,
  type SafeHttpClient,
} from '../internet-archive/shared/http-port.js';
import type { SourceRegistryEntry } from '../types.js';
import { buildRedditNewListingUrl, parseRedditListingResponse } from './client.js';
import { normalizeRedditBatch } from './normalizer.js';
import type { SubredditRegistryEntry } from './subreddit-registry.js';
import { REDDIT_LISTING_MAX_ITEMS, REDDIT_LISTING_MAX_PAGE_SIZE } from './types.js';
import type { RedditCandidateRecord } from './types.js';

const REDDIT_ALLOWED_CONTENT_TYPES = ['application/json', 'text/json'];

export type FetchSubredditListingInput = {
  readonly subreddit: SubredditRegistryEntry;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly client: SafeHttpClient;
  readonly retries?: number;
  /** Caps how many items this poll walks via `after`-cursor pagination. Defaults to Reddit's
   * own 1000-item listing ceiling; tests pass a small value to exercise the pagination loop
   * without needing 1000-item fixtures. */
  readonly maxItems?: number;
  readonly pageSize?: number;
};

/**
 * Fetches (and normalizes) one subreddit's `/new` listing, paginating via the `after` cursor
 * until `maxItems` is reached, a page comes back short, or there is no further cursor.
 */
export async function fetchSubredditNewListing(
  input: FetchSubredditListingInput,
): Promise<readonly RedditCandidateRecord[]> {
  const maxItems = Math.min(input.maxItems ?? REDDIT_LISTING_MAX_ITEMS, REDDIT_LISTING_MAX_ITEMS);
  const pageSize = Math.min(
    input.pageSize ?? REDDIT_LISTING_MAX_PAGE_SIZE,
    REDDIT_LISTING_MAX_PAGE_SIZE,
  );

  const candidates: RedditCandidateRecord[] = [];
  let after: string | undefined;

  while (candidates.length < maxItems) {
    const remaining = maxItems - candidates.length;
    const limit = Math.min(pageSize, remaining);
    const url = buildRedditNewListingUrl({
      subredditName: input.subreddit.subredditName,
      limit,
      ...(after !== undefined ? { after } : {}),
    });

    const response = await withRetry(
      () => input.client({ url, method: 'GET', allowedContentTypes: REDDIT_ALLOWED_CONTENT_TYPES }),
      { retries: input.retries ?? 3, baseDelayMs: 250, isRetryable: defaultIsRetryable },
    );
    assertAllowedContentType(response, REDDIT_ALLOWED_CONTENT_TYPES);

    const raw = JSON.parse(response.bodyText) as unknown;
    const parsed = parseRedditListingResponse(raw);
    const pageCandidates = normalizeRedditBatch({
      subreddit: input.subreddit,
      posts: parsed.posts,
      registryEntry: input.registryEntry,
      runId: input.runId,
      capturedAt: input.capturedAt,
    });
    candidates.push(...pageCandidates);

    if (!parsed.after || parsed.posts.length === 0) {
      break;
    }
    after = parsed.after;
  }

  return candidates.slice(0, maxItems);
}

/** Modest-concurrency fan-out across the active curated subreddit registry mirrors
 * ./rss/fetch-feed.ts's `fetchAndNormalizeFeeds`. */
export async function fetchSubredditNewListings(input: {
  readonly subreddits: readonly SubredditRegistryEntry[];
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly client: SafeHttpClient;
  readonly concurrency?: number;
  readonly maxItemsPerSubreddit?: number;
}): Promise<readonly RedditCandidateRecord[]> {
  const perSubreddit = await mapWithConcurrency(
    input.subreddits,
    input.concurrency ?? 2,
    (subreddit) =>
      fetchSubredditNewListing({
        subreddit,
        registryEntry: input.registryEntry,
        runId: input.runId,
        capturedAt: input.capturedAt,
        client: input.client,
        ...(input.maxItemsPerSubreddit !== undefined
          ? { maxItems: input.maxItemsPerSubreddit }
          : {}),
      }),
  );
  return perSubreddit.flat();
}
