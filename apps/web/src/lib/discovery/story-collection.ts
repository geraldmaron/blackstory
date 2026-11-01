/**
 * Story collections: `collection=story:<published-slug>` names exactly the records a published
 * story links to explicitly (`storyCitedEntities`: related entity ids plus map inset ids).
 * Nothing is inferred from prose, proximity or author reference counts.
 *
 * The `story:` prefix keeps this apart from a story's editorial series (`doc.collection.id`,
 * the `/stories?collection=` filter), which is a different thing with a different vocabulary.
 *
 * A collection token is always one of:
 *  - `''`                    no collection (the whole archive);
 *  - `story:<slug>`          a well-formed story reference;
 *  - `missing`               a well-formed reference to a story the release does not have
 *                            (temporary: the story may publish later);
 *  - `invalid`               malformed input, never a bare archive.
 *
 * The reader resolves a token to one of four descriptor states. `live` includes a story with zero
 * linked records; `unknown` and `unavailable` are never zero members and never the full archive.
 *
 * Client-safe leaf module: pure types and builders, no storage, no catalog imports.
 */

export const STORY_COLLECTION_PREFIX = 'story:';
export const COLLECTION_INVALID = 'invalid' as const;
export const COLLECTION_MISSING = 'missing' as const;

/** Published story slugs are lowercase kebab; bounded so a token cannot mint unbounded keys. */
const STORY_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,94}[a-z0-9])?$/;

export type CollectionToken =
  '' | typeof COLLECTION_INVALID | typeof COLLECTION_MISSING | `story:${string}`;

export function storyCollectionToken(slug: string): CollectionToken {
  return STORY_SLUG.test(slug) ? `${STORY_COLLECTION_PREFIX}${slug}` : COLLECTION_INVALID;
}

/** Normalizes one raw `collection` value. Case and whitespace fold; anything else is `invalid`. */
export function parseCollectionToken(raw: string | readonly string[] | undefined): CollectionToken {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const value = typeof first === 'string' ? first.trim().toLowerCase() : '';
  if (value === '') return '';
  if (value === COLLECTION_MISSING) return COLLECTION_MISSING;
  if (value.startsWith(STORY_COLLECTION_PREFIX)) {
    return storyCollectionToken(value.slice(STORY_COLLECTION_PREFIX.length));
  }
  return COLLECTION_INVALID;
}

export function storyCollectionSlug(token: CollectionToken): string | undefined {
  return token.startsWith(STORY_COLLECTION_PREFIX)
    ? token.slice(STORY_COLLECTION_PREFIX.length)
    : undefined;
}

/** What the story reader returns before membership is resolved against released records. */
export type StoryCollectionSource =
  | {
      readonly state: 'live';
      readonly slug: string;
      readonly title: string;
      /** Explicit links only. May be empty. Unresolved ids are never surfaced past the loader. */
      readonly linkedIds: readonly string[];
    }
  | { readonly state: 'unknown'; readonly slug: string }
  | { readonly state: 'unavailable'; readonly slug: string };

export type StoryCollectionDescriptor =
  | {
      readonly state: 'live';
      readonly slug: string;
      readonly title: string;
      readonly href: string;
      /** Linked records that resolve to released bibliography records. */
      readonly memberIds: readonly string[];
      /** Linked records that did not resolve. A count only; never ids or names. */
      readonly unresolvedCount: number;
    }
  | { readonly state: 'unknown'; readonly slug: string }
  | { readonly state: 'unavailable'; readonly slug: string }
  | { readonly state: 'missing' }
  | { readonly state: 'invalid' };

export type CollectionDescriptor = { readonly state: 'none' } | StoryCollectionDescriptor;

export const NO_COLLECTION: CollectionDescriptor = Object.freeze({ state: 'none' });

/** Membership resolves only over released bibliography ids; the rest is counted, not named. */
export function resolveStoryCollection(
  source: StoryCollectionSource,
  releasedIds: ReadonlySet<string>,
): StoryCollectionDescriptor {
  if (source.state !== 'live') return source;
  const linked = [...new Set(source.linkedIds)];
  const memberIds = linked.filter((id) => releasedIds.has(id));
  return {
    state: 'live',
    slug: source.slug,
    title: source.title,
    href: `/stories/${source.slug}`,
    memberIds,
    unresolvedCount: linked.length - memberIds.length,
  };
}

/** Descriptor for a token that needs no read (sentinels), or `undefined` when a read is needed. */
export function collectionDescriptorWithoutRead(
  token: CollectionToken,
): CollectionDescriptor | undefined {
  if (token === '') return NO_COLLECTION;
  if (token === COLLECTION_INVALID) return { state: 'invalid' };
  if (token === COLLECTION_MISSING) return { state: 'missing' };
  return undefined;
}

/**
 * Member ids a matcher may filter by, or `undefined` when the collection cannot be resolved.
 * Callers pass `undefined` straight to `matchesExcept`, which then matches nothing: a failed or
 * unknown collection must not widen to the archive nor pretend to be an empty story.
 */
export function collectionMemberIds(
  descriptor: CollectionDescriptor,
): ReadonlySet<string> | undefined {
  if (descriptor.state === 'none') return undefined;
  if (descriptor.state === 'live') return new Set(descriptor.memberIds);
  return undefined;
}

/** True when the page should render an explicit error/absence state instead of a result list. */
export function collectionIsUnresolved(descriptor: CollectionDescriptor): boolean {
  return (
    descriptor.state === 'unknown' ||
    descriptor.state === 'unavailable' ||
    descriptor.state === 'missing' ||
    descriptor.state === 'invalid'
  );
}

/** Plain-language state for the collection strip and the error panels. */
export function collectionStateMessage(descriptor: CollectionDescriptor): string | undefined {
  switch (descriptor.state) {
    case 'none':
    case 'live':
      return undefined;
    case 'unknown':
    case 'missing':
      return 'This story is not in the published release, so there is no collection to show. It may be published later.';
    case 'unavailable':
      return 'The story could not be read just now, so its records cannot be listed. Reload to try again. This is not an empty collection.';
    case 'invalid':
      return 'This collection address is not readable. No records are shown for it.';
  }
}
