/**
 * Reddit discovery adapter public surface (BB-074, gated channel). Ships registered but
 * DISABLED in the BB-037 registry — see ./contract.ts's module doc for the HUMAN STEP
 * (Responsible Builder application) that must be recorded before an operator may ever change
 * that registry entry's state.
 */
export {
  REDDIT_ADAPTER_ID,
  REDDIT_PARSER_VERSION,
  REDDIT_STABLE_ID_SCHEME,
  REDDIT_PAYLOAD_SCHEMA_VERSION,
  REDDIT_DEFAULT_CLASSIFICATION,
  REDDIT_FREE_TIER_QPM_LIMIT,
  REDDIT_LISTING_MAX_ITEMS,
  REDDIT_LISTING_MAX_PAGE_SIZE,
  REDDIT_STRUCTURAL_LIMITATIONS,
  REDDIT_SUBREDDIT_CATEGORIES,
  type RedditStructuralLimitation,
  type RedditSubredditCategory,
  type RawRedditPostData,
  type RawRedditListingChild,
  type RawRedditListing,
  type RedditRejectedPost,
  type RedditParsedListing,
  type RedditCandidatePayload,
  type RedditCandidateRecord,
  type RedditStoredPointer,
} from './types.js';

export {
  assertNoForbiddenExportSurface,
  assertNoIdentityFields,
  assertNoFullContentFields,
} from './guards.js';

export {
  REDDIT_OAUTH_BASE_URL,
  buildRedditNewListingUrl,
  buildRedditInfoUrl,
  parseRedditListingResponse,
  isPostRemovedOrDeleted,
  type BuildRedditListingUrlInput,
} from './client.js';

export {
  capRedditSnippet,
  buildRedditPermalink,
  normalizeRedditPost,
  normalizeRedditBatch,
  assertRedditCandidate,
  type NormalizeRedditPostInput,
} from './normalizer.js';

export {
  SUBREDDIT_REGISTRY_SCHEMA_VERSION,
  createInMemorySubredditRegistry,
  addSubredditToRegistry,
  removeSubredditFromRegistry,
  listActiveSubreddits,
  defaultSubredditRegistrySeed,
  type SubredditRegistryEntry,
  type SubredditRegistryEntryStatus,
  type SubredditRegistryStore,
  type AddSubredditInput,
  type SubredditRegistryMutationResult,
} from './subreddit-registry.js';

export { REDDIT_ATTRIBUTION_NOTICE, createRedditAdapterContract } from './contract.js';

export {
  fetchSubredditNewListing,
  fetchSubredditNewListings,
  type FetchSubredditListingInput,
} from './fetch-listing.js';

export {
  worstCaseMaxPagesPerCycle,
  estimateWorstCaseRequestsPerMinute,
  type RateLimitDesignInput,
} from './rate-limit-design.js';

export {
  REDDIT_LIVENESS_REASONS,
  checkRedditPostLivenessViaListingLookup,
  assertPointerLiveBeforeReview,
  type RedditLivenessReason,
  type RedditLivenessCheckResult,
  type RedditLivenessChecker,
} from './liveness.js';

export {
  REDDIT_DELETION_SYNC_MAX_HOURS,
  buildRedditPointerCascadeTargets,
  planRedditPointerPurge,
  sweepRedditPointerLiveness,
  applyRedditPointerPurge,
  type RedditPointerCascadePaths,
  type PlanRedditPointerPurgeInput,
  type RedditDeletionSyncSweepOutcome,
  type SweepRedditPointerLivenessInput,
  type RedditPurgeableStore,
} from './deletion-sync.js';
