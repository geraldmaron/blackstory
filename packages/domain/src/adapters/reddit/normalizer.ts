/**
 * Normalize parsed Reddit posts into AdapterCandidateRecord output. Mirrors
 * ./rss/normalizer.ts /../dpla/normalizer.ts exactly: cap the triage snippet to the 
 * evidence-pointer snippet limits, stamp provenance, and fail closed on any doctrine
 * violation via ./guards.ts rather than silently dropping a field.
 */
import { MAX_EVIDENCE_SNIPPET_CHARACTERS, MAX_EVIDENCE_SNIPPET_WORDS } from '../../rights/evidence-pointer.js';
import { stampCandidateProvenance } from '../candidates.js';
import type { SourceRegistryEntry } from '../types.js';
import { isPostRemovedOrDeleted } from './client.js';
import { assertNoFullContentFields, assertNoIdentityFields } from './guards.js';
import type { SubredditRegistryEntry } from './subreddit-registry.js';
import { REDDIT_ADAPTER_ID, REDDIT_PAYLOAD_SCHEMA_VERSION } from './types.js';
import type { RawRedditPostData, RedditCandidatePayload, RedditCandidateRecord } from './types.js';

/**
 * Caps a title + short excerpt to the evidence-pointer snippet limits the minimum
 * needed for reviewer triage, never a full post body (see ./guards.ts assertNoFullContentFields
 * for the structural backstop).
 */
export function capRedditSnippet(text: string | undefined): string | undefined {
  if (!text) return undefined;
  let capped = text.trim();
  if (capped.length > MAX_EVIDENCE_SNIPPET_CHARACTERS) {
    capped = capped.slice(0, MAX_EVIDENCE_SNIPPET_CHARACTERS).trim();
  }
  const words = capped.split(/\s+/u).filter(Boolean);
  if (words.length > MAX_EVIDENCE_SNIPPET_WORDS) {
    capped = words.slice(0, MAX_EVIDENCE_SNIPPET_WORDS).join(' ');
  }
  return capped || undefined;
}

function buildTriageText(post: RawRedditPostData): string | undefined {
  const parts = [post.title, post.selftext].filter((part): part is string => Boolean(part && part.trim()));
  if (!parts.length) return undefined;
  return parts.join(' — ');
}

export function buildRedditPermalink(post: RawRedditPostData): string {
  return post.permalink.startsWith('http') ? post.permalink : `https://www.reddit.com${post.permalink}`;
}

function buildStableIdentifier(subredditRegistryId: string, postId: string): string {
  return `reddit:${subredditRegistryId}:${postId}`;
}

export type NormalizeRedditPostInput = {
  readonly subreddit: SubredditRegistryEntry;
  readonly post: RawRedditPostData;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
};

export function normalizeRedditPost(input: NormalizeRedditPostInput): RedditCandidateRecord {
  const permalink = buildRedditPermalink(input.post);
  const snippet = capRedditSnippet(buildTriageText(input.post));

  const payload: RedditCandidatePayload = {
    schemaVersion: REDDIT_PAYLOAD_SCHEMA_VERSION,
    subredditRegistryId: input.subreddit.id,
    subreddit: input.post.subreddit,
    postId: input.post.id,
    permalink,
    // Handle only never the internal author_fullname account id (see types.ts module doc).
    ...(input.post.author !== undefined ? { authorHandle: input.post.author } : {}),
    postedAt: new Date(input.post.created_utc * 1000).toISOString(),
    ...(snippet !== undefined ? { snippet } : {}),
    ...(input.post.num_comments !== undefined ? { numComments: input.post.num_comments } : {}),
    ...(input.post.score !== undefined ? { score: input.post.score } : {}),
  };

  assertNoIdentityFields(payload as unknown as Record<string, unknown>);
  assertNoFullContentFields(payload as unknown as Record<string, unknown>);

  const candidate = stampCandidateProvenance(input.registryEntry, input.runId, input.capturedAt, {
    stableIdentifier: buildStableIdentifier(input.subreddit.id, input.post.id),
    ...(input.post.title !== undefined ? { title: input.post.title } : {}),
    canonicalUrl: permalink,
    classification: input.subreddit.classification,
    payload: payload as Readonly<Record<string, unknown>>,
  });

  assertRedditCandidate(candidate as RedditCandidateRecord);
  return candidate as RedditCandidateRecord;
}

/**
 * Normalizes a batch of posts, silently skipping any already removed/deleted by the time this
 * poll observed them (see ../../adapters/reddit/client.ts `isPostRemovedOrDeleted`) there is
 * no discovery value in ingesting a pointer to content that is already gone, and skipping at
 * ingest keeps the deletion-sync purge queue to genuinely-live-then-removed content only.
 */
export function normalizeRedditBatch(input: {
  readonly subreddit: SubredditRegistryEntry;
  readonly posts: readonly RawRedditPostData[];
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
}): readonly RedditCandidateRecord[] {
  return input.posts
    .filter((post) => !isPostRemovedOrDeleted(post))
    .map((post) =>
      normalizeRedditPost({
        subreddit: input.subreddit,
        post,
        registryEntry: input.registryEntry,
        runId: input.runId,
        capturedAt: input.capturedAt,
      }),
    );
}

export function assertRedditCandidate(candidate: RedditCandidateRecord): void {
  if (candidate.provenance.adapterId !== REDDIT_ADAPTER_ID) {
    throw new Error(`Expected adapterId ${REDDIT_ADAPTER_ID}`);
  }
  const payload = candidate.payload;
  if (payload.schemaVersion !== REDDIT_PAYLOAD_SCHEMA_VERSION) {
    throw new Error(`Unexpected payload schema version: ${payload.schemaVersion}`);
  }
  if (payload.snippet && payload.snippet.length > MAX_EVIDENCE_SNIPPET_CHARACTERS) {
    throw new Error('Reddit candidate snippet exceeds the evidence-pointer snippet cap');
  }
  if (!payload.subreddit.trim() || !payload.postId.trim() || !payload.permalink.trim() || !payload.postedAt.trim()) {
    throw new Error('Reddit candidate payload is missing a required pointer field');
  }
}
