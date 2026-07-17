/**
 * Reddit discovery adapter types (BB-074, gated channel).
 *
 * Reddit 2026 reality (primary sources, see the bead's DESIGN note): self-service API
 * registration is closed under Reddit's Responsible Builder Policy (ticket queue, 2-4 week
 * lead time — a HUMAN STEP, see ../../adapters/reddit/contract.ts and this bead's final
 * report); unauthenticated `.json` endpoints return 403 since May 2026, so every request this
 * adapter builds targets the OAuth `oauth.reddit.com` host and requires a bearer token the
 * caller supplies (never hardcoded, never read from an env var by this package — mirrors
 * ../dpla/fetch-search.ts's DPLA_API_KEY discipline); free tier is 100 queries/minute,
 * non-commercial use only. Threads are discovery leads that point researchers at verifiable
 * primary sources — never evidence of record, never republished (see ./guards.ts).
 */
import type { AdapterCandidateRecord } from '../types.js';

export const REDDIT_ADAPTER_ID = 'reddit' as const;
export const REDDIT_PARSER_VERSION = 'reddit-parser-1.0.0' as const;
export const REDDIT_STABLE_ID_SCHEME = 'reddit-post' as const;
export const REDDIT_PAYLOAD_SCHEMA_VERSION = 'reddit-payload.v1' as const;

/**
 * UGC discussion threads map onto the constitution's `community_oral` tier
 * (packages/schemas/constitution/policy.v1.json `sourceClassifications`) — the same tier RSS's
 * community-oral feed entries and Internet Archive's raw uploads use.
 */
export const REDDIT_DEFAULT_CLASSIFICATION = 'community_oral' as const;

/** Reddit's own free-tier OAuth ceiling (2026, non-commercial). The polling cadence and curated
 *  subreddit list are sized to stay far below this — see contract.ts and subreddit-registry.ts. */
export const REDDIT_FREE_TIER_QPM_LIMIT = 100;

/** Reddit's hard cap on any single listing (`/new`, `/hot`, ...), regardless of how many pages
 *  of `after`-cursor pagination are walked. Older items beyond this horizon are structurally
 *  unreachable via listing polling — there is no server-side workaround. */
export const REDDIT_LISTING_MAX_ITEMS = 1000;

/** Reddit's own per-request page-size ceiling for listing endpoints. */
export const REDDIT_LISTING_MAX_PAGE_SIZE = 100;

export type RedditStructuralLimitation = {
  readonly id: 'no_date_range_search' | 'no_comment_search' | 'listing_cap_1000_items';
  readonly description: string;
};

/**
 * Documented structural gaps in Reddit's public API surface (not bugs in this adapter — there
 * is no request shape that works around them). Encoded as data so a test can assert the adapter
 * makes no undocumented promise beyond these limits (see reddit.test.ts).
 */
export const REDDIT_STRUCTURAL_LIMITATIONS: readonly RedditStructuralLimitation[] = [
  {
    id: 'no_date_range_search',
    description:
      'Reddit listing/search endpoints have no server-side date-range filter; only chronological ' +
      '/new polling with client-side timestamp filtering is possible.',
  },
  {
    id: 'no_comment_search',
    description:
      'This adapter polls post listings only. Reddit has no comment-level search endpoint, so ' +
      'comment threads are never ingested — only the parent post is a discovery lead.',
  },
  {
    id: 'listing_cap_1000_items',
    description:
      `Any single listing is capped at ${REDDIT_LISTING_MAX_ITEMS} items regardless of pagination ` +
      'depth; older items beyond that horizon are unreachable via listing polling alone.',
  },
];

/** Curated subreddit categories the registry's seed list groups entries under (BB-074 bead text). */
export const REDDIT_SUBREDDIT_CATEGORIES = ['topical', 'city', 'state'] as const;
export type RedditSubredditCategory = (typeof REDDIT_SUBREDDIT_CATEGORIES)[number];

/**
 * Raw post fields as Reddit's `/r/<sub>/new` and `/api/info` OAuth listing endpoints return them
 * (a `Listing` envelope of `t3` "post" children). Only the fields this adapter actually reads are
 * typed; everything else Reddit returns (vote internals, awards, media metadata, ...) is
 * deliberately never modeled or stored — see ./normalizer.ts and ./guards.ts for the structural
 * enforcement of that boundary. Note `author_fullname` (Reddit's internal `t2_...` account id) is
 * intentionally NOT part of this type: this adapter only ever stores the human-readable `author`
 * handle string, never an account identifier that could seed further lookups.
 */
export type RawRedditPostData = {
  readonly id: string;
  readonly name?: string;
  readonly subreddit: string;
  readonly title?: string;
  readonly selftext?: string;
  readonly permalink: string;
  readonly author?: string;
  readonly created_utc: number;
  readonly num_comments?: number;
  readonly score?: number;
  /** Non-null when a moderator/admin/Reddit itself removed the post (see ./client.ts liveness use). */
  readonly removed_by_category?: string | null;
};

export type RawRedditListingChild = {
  readonly kind: string;
  readonly data: RawRedditPostData;
};

export type RawRedditListing = {
  readonly kind: string;
  readonly data: {
    readonly children: readonly unknown[];
    readonly after?: string | null;
  };
};

export type RedditRejectedPost = {
  readonly index: number;
  readonly reason: string;
};

export type RedditParsedListing = {
  readonly posts: readonly RawRedditPostData[];
  readonly rejected: readonly RedditRejectedPost[];
  readonly after?: string;
};

/**
 * Normalized candidate payload. Deliberately minimal: permalink, post id, subreddit, timestamp,
 * the author HANDLE only (never resolved further — see ./guards.ts assertNoIdentityFields), and
 * a triage snippet capped exactly like every other BB-073/074 adapter's snippet (see
 * ../../rights/evidence-pointer.ts MAX_EVIDENCE_SNIPPET_*). There is deliberately no field here
 * that can hold a full post body, all comments, or any identity-resolving data.
 */
export type RedditCandidatePayload = {
  readonly schemaVersion: typeof REDDIT_PAYLOAD_SCHEMA_VERSION;
  readonly subredditRegistryId: string;
  readonly subreddit: string;
  readonly postId: string;
  readonly permalink: string;
  /** Reddit username handle as displayed, e.g. "some_user". Never resolved to a real identity;
   *  "[deleted]" when the account itself has been deleted. */
  readonly authorHandle?: string;
  readonly postedAt: string;
  /** Capped to the BB-077 evidence-pointer snippet limits — a title + short excerpt only, never
   *  the full post body or any comments. Reviewer-triage use only, never republished. */
  readonly snippet?: string;
  readonly numComments?: number;
  readonly score?: number;
};

export type RedditCandidateRecord = AdapterCandidateRecord & {
  readonly payload: RedditCandidatePayload;
};

/** Minimal stored-pointer shape the deletion-sync liveness sweep and pre-review gate operate on
 *  (see ./liveness.ts, ./deletion-sync.ts). Intentionally the same minimal field set as the
 *  candidate payload above — a pointer is never enriched with anything the payload doesn't have. */
export type RedditStoredPointer = {
  readonly id: string;
  readonly stableIdentifier: string;
  readonly subredditRegistryId: string;
  readonly subreddit: string;
  readonly postId: string;
  readonly permalink: string;
  readonly authorHandle?: string;
  readonly capturedAt: string;
  readonly snippet?: string;
};
