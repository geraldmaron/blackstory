/**
 * Reddit OAuth listing URL builders and defensive JSON parsing (BB-074). Every URL targets
 * `oauth.reddit.com` — the unauthenticated `www.reddit.com/*.json` surface returns 403 as of
 * May 2026 (see ../../adapters/reddit/types.ts module doc) — and every request requires a
 * caller-supplied bearer token; this module never reads one from an environment variable or
 * hardcodes one (mirrors ../dpla/fetch-search.ts's DPLA_API_KEY discipline).
 */
import { REDDIT_LISTING_MAX_PAGE_SIZE } from './types.js';
import type { RawRedditPostData, RedditParsedListing, RedditRejectedPost } from './types.js';

export const REDDIT_OAUTH_BASE_URL = 'https://oauth.reddit.com' as const;

export type BuildRedditListingUrlInput = {
  readonly subredditName: string;
  readonly limit: number;
  readonly after?: string;
};

/** Builds a `/r/<sub>/new` listing URL — chronological, the only ordering this adapter polls. */
export function buildRedditNewListingUrl(input: BuildRedditListingUrlInput): string {
  if (!input.subredditName.trim()) {
    throw new Error('subredditName is required to build a Reddit listing URL');
  }
  const limit = Math.min(Math.max(1, input.limit), REDDIT_LISTING_MAX_PAGE_SIZE);
  const url = new URL(`${REDDIT_OAUTH_BASE_URL}/r/${encodeURIComponent(input.subredditName)}/new`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('raw_json', '1');
  if (input.after) {
    url.searchParams.set('after', input.after);
  }
  return url.toString();
}

/** Builds an `/api/info` lookup URL for one or more post fullnames (e.g. `t3_abc123`) — used by
 *  the liveness re-check (see ./liveness.ts), not the discovery poll. */
export function buildRedditInfoUrl(fullnames: readonly string[]): string {
  if (!fullnames.length) {
    throw new Error('At least one fullname is required to build a Reddit /api/info URL');
  }
  const url = new URL(`${REDDIT_OAUTH_BASE_URL}/api/info`);
  url.searchParams.set('id', fullnames.join(','));
  url.searchParams.set('raw_json', '1');
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractPostData(child: unknown, index: number, rejected: RedditRejectedPost[]): RawRedditPostData | undefined {
  if (!isRecord(child) || child.kind !== 't3' || !isRecord(child.data)) {
    rejected.push({ index, reason: 'not a t3 (post) listing child' });
    return undefined;
  }
  const data = child.data;
  const id = typeof data.id === 'string' ? data.id : undefined;
  const subreddit = typeof data.subreddit === 'string' ? data.subreddit : undefined;
  const permalink = typeof data.permalink === 'string' ? data.permalink : undefined;
  const createdUtc = typeof data.created_utc === 'number' ? data.created_utc : undefined;
  if (!id || !subreddit || !permalink || createdUtc === undefined) {
    rejected.push({ index, reason: 'missing required field (id/subreddit/permalink/created_utc)' });
    return undefined;
  }
  return {
    id,
    ...(typeof data.name === 'string' ? { name: data.name } : {}),
    subreddit,
    ...(typeof data.title === 'string' ? { title: data.title } : {}),
    ...(typeof data.selftext === 'string' ? { selftext: data.selftext } : {}),
    permalink,
    ...(typeof data.author === 'string' ? { author: data.author } : {}),
    created_utc: createdUtc,
    ...(typeof data.num_comments === 'number' ? { num_comments: data.num_comments } : {}),
    ...(typeof data.score === 'number' ? { score: data.score } : {}),
    ...(data.removed_by_category === null || typeof data.removed_by_category === 'string'
      ? { removed_by_category: data.removed_by_category }
      : {}),
  };
}

/**
 * Defensively parses a Reddit `Listing` JSON envelope (shared by `/r/<sub>/new` and
 * `/api/info`) into typed posts. A malformed/unexpected child is recorded in `rejected` rather
 * than thrown — one bad entry never poisons a whole page (mirrors ../dpla/client.ts's tolerance
 * pattern) — but a response that isn't a `Listing` at all throws, since that means the caller
 * built the wrong URL or Reddit changed the envelope shape entirely.
 */
export function parseRedditListingResponse(raw: unknown): RedditParsedListing {
  if (!isRecord(raw) || raw.kind !== 'Listing' || !isRecord(raw.data) || !Array.isArray(raw.data.children)) {
    throw new Error('Reddit response is not a recognized Listing envelope');
  }
  const rejected: RedditRejectedPost[] = [];
  const posts: RawRedditPostData[] = [];
  raw.data.children.forEach((child, index) => {
    const post = extractPostData(child, index, rejected);
    if (post) {
      posts.push(post);
    }
  });
  const after = typeof raw.data.after === 'string' ? raw.data.after : undefined;
  return { posts, rejected, ...(after !== undefined ? { after } : {}) };
}

/** True when Reddit has marked a post removed (moderator/admin/Reddit) or the author account has
 *  been deleted — the two signals the /new listing and /api/info responses actually expose. */
export function isPostRemovedOrDeleted(post: RawRedditPostData): boolean {
  return Boolean(post.removed_by_category) || post.author === '[deleted]';
}
