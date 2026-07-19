/**
 * Fetches and normalizes a single curated RSS/Atom feed through the safe-HTTP port
 * Never calls `fetch` directly see ../internet-archive/shared/http-port.ts for why.
 */
import {
  assertAllowedContentType,
  defaultIsRetryable,
  mapWithConcurrency,
  withRetry,
  type SafeHttpClient,
} from '../internet-archive/shared/http-port.js';
import type { SourceRegistryEntry } from '../types.js';
import type { FeedRegistryEntry } from './feed-registry.js';
import { normalizeFeedXml } from './normalizer.js';
import type { RssCandidateRecord } from './types.js';

const RSS_ALLOWED_CONTENT_TYPES = [
  'application/rss+xml',
  'application/atom+xml',
  'application/xml',
  'text/xml',
  // Some publishers mislabel feeds; the parser itself still validates structure.
  'text/plain',
];

export type FetchFeedInput = {
  readonly feed: FeedRegistryEntry;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly client: SafeHttpClient;
  readonly retries?: number;
};

export async function fetchAndNormalizeFeed(
  input: FetchFeedInput,
): Promise<readonly RssCandidateRecord[]> {
  const response = await withRetry(
    () =>
      input.client({
        url: input.feed.feedUrl,
        method: 'GET',
        allowedContentTypes: RSS_ALLOWED_CONTENT_TYPES,
      }),
    { retries: input.retries ?? 3, baseDelayMs: 250, isRetryable: defaultIsRetryable },
  );
  assertAllowedContentType(response, RSS_ALLOWED_CONTENT_TYPES);

  return normalizeFeedXml({
    feed: input.feed,
    xml: response.bodyText,
    registryEntry: input.registryEntry,
    runId: input.runId,
    capturedAt: input.capturedAt,
  });
}

/** Modest-concurrency fan-out across the active feed registry. */
export async function fetchAndNormalizeFeeds(input: {
  readonly feeds: readonly FeedRegistryEntry[];
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly client: SafeHttpClient;
  readonly concurrency?: number;
}): Promise<readonly RssCandidateRecord[]> {
  const perFeed = await mapWithConcurrency(input.feeds, input.concurrency ?? 4, (feed) =>
    fetchAndNormalizeFeed({
      feed,
      registryEntry: input.registryEntry,
      runId: input.runId,
      capturedAt: input.capturedAt,
      client: input.client,
    }),
  );
  return perFeed.flat();
}
