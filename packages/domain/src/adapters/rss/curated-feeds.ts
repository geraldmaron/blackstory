/**
 * Curated community RSS feed seed list with explicit extra-care policies.
 *
 * Feeds here are discovery indexes only: snippet + link + optional authority follow-ups.
 * Registration starts disabled until an operator approves the source adapter policy.
 * Never treat a community feed hit as primary evidence or a publishable claim.
 */
import type { AuditActor } from '../../audit/index.js';
import {
  addFeedToRegistry,
  type AddFeedInput,
  type FeedRegistryMutationResult,
  type FeedRegistryStore,
} from './feed-registry.js';
import type { RssFeedClassification, RssFeedInstitutionType } from './types.js';

export const CURATED_COMMUNITY_FEED_SEED_VERSION = 'curated-community-feeds.v1' as const;

/**
 * Extra-care flags for community feeds. These are policy hints for campaign runners —
 * the RSS adapter itself still only stores title/link/capped summary + outboundLinkHints.
 */
export type CommunityFeedCarePolicy = {
  /** Low-authority tier classification for the feed. */
  readonly classification: RssFeedClassification;
  readonly institutionType: RssFeedInstitutionType;
  /** Must run authority-host harvest after accept. */
  readonly requireAuthorityHarvest: true;
  /** Must attempt catalog propose-match when profiles are available. */
  readonly preferCatalogMatch: true;
  /** Full article bodies / content:encoded prose must never be retained. */
  readonly snippetOnly: true;
  /** Feed alone cannot satisfy publish / include-without-corroboration gates. */
  readonly cannotPublishAlone: true;
  /** Operator-facing caution shown in admin/docs. */
  readonly operatorCaution: string;
};

export type CuratedCommunityFeedSeed = AddFeedInput & {
  readonly care: CommunityFeedCarePolicy;
  readonly homepageUrl: string;
};

/**
 * Seeded curated community feeds. ABS is editorial/self-published place-history storytelling —
 * useful as a lead index because posts often cite NPS/NMAAHC, not as a sole evidence source.
 */
export const CURATED_COMMUNITY_FEED_SEEDS: readonly CuratedCommunityFeedSeed[] = [
  {
    id: 'feed_the_american_blackstory',
    feedUrl: 'https://theamericanblackstory.com/feed/',
    displayName: 'The American Blackstory',
    homepageUrl: 'https://theamericanblackstory.com/',
    classification: 'self_published',
    institutionType: 'personal_blog',
    notes:
      'Editorial Black history storytelling (WordPress RSS). Extra care: self_published, ' +
      'snippet-only, authority harvest + catalog propose-match required before treating as ' +
      'corroboration. Mix of place-history days and brand storytelling (“Black Bags”) — ' +
      'relevance/obscurity scoring should down-rank pure brand posts.',
    care: {
      classification: 'self_published',
      institutionType: 'personal_blog',
      requireAuthorityHarvest: true,
      preferCatalogMatch: true,
      snippetOnly: true,
      cannotPublishAlone: true,
      operatorCaution:
        'Treat ABS items as private discovery leads. Prefer outbound NPS/LOC/NMAAHC links ' +
        'as evidence follow-ups. Do not republish full posts. Brand/commerce posts are weak ' +
        'history-place signal.',
    },
  },
];

export function getCuratedCommunityFeedSeed(id: string): CuratedCommunityFeedSeed | undefined {
  return CURATED_COMMUNITY_FEED_SEEDS.find((seed) => seed.id === id);
}

export function assertCommunityFeedCarePolicy(care: CommunityFeedCarePolicy): void {
  if (!care.requireAuthorityHarvest || !care.preferCatalogMatch || !care.snippetOnly || !care.cannotPublishAlone) {
    throw new Error('Community feed care policy missing required extra-care flags');
  }
  if (!care.operatorCaution.trim()) {
    throw new Error('Community feed care policy requires operatorCaution text');
  }
}

/**
 * Registers all curated community feed seeds into an in-memory (or injected) registry.
 * Does not approve the RSS adapter policy — feeds remain inert until `approveSourcePolicy`.
 */
export function seedCuratedCommunityFeeds(
  store: FeedRegistryStore,
  context: {
    readonly actor: AuditActor;
    readonly reason: string;
    readonly requestId: string;
    readonly correlationId: string;
    readonly now: string;
  },
): readonly FeedRegistryMutationResult[] {
  const results: FeedRegistryMutationResult[] = [];
  for (const seed of CURATED_COMMUNITY_FEED_SEEDS) {
    assertCommunityFeedCarePolicy(seed.care);
    if (store.get(seed.id)) {
      continue;
    }
    const input: AddFeedInput = {
      id: seed.id,
      feedUrl: seed.feedUrl,
      displayName: seed.displayName,
      classification: seed.classification,
      institutionType: seed.institutionType,
      ...(seed.notes !== undefined ? { notes: seed.notes } : {}),
    };
    results.push(addFeedToRegistry(store, input, context));
  }
  return results;
}
