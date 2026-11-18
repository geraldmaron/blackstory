/**
 * Live stories for the phone: `/v1/stories` (the list) and `/v1/stories/{slug}` (one piece).
 *
 * Same posture as `features/entity/dataClient.ts`, and built on the same layers (`@/data`
 * transport and release cache): network first, the release-coupled cache on any failure except an
 * authoritative 404, and an honest offline state rather than a spinner. Every body is parsed with
 * the public contract before it is cached or shown, so a malformed payload is an error state, not
 * a broken screen.
 */
import { TransportError } from '@/data';
import {
  storiesResponseV1Schema,
  storyV1Schema,
  type StoryListItemV1,
  type StoryV1,
} from '@repo/public-contracts/v1/story';
import type { EntityDataDeps } from '@/features/entity/dataClient';

export type StoryDataDeps = EntityDataDeps;

export interface StoryFreshness {
  readonly source: 'network' | 'cache';
  readonly fetchedAt: number;
  readonly degraded: boolean;
}

export type StoryFetchResult<T> =
  | { readonly status: 'ready'; readonly value: T; readonly freshness: StoryFreshness }
  | { readonly status: 'not-found' }
  | { readonly status: 'offline-no-cache' }
  | { readonly status: 'error'; readonly message: string };

type Parse<T> = (raw: unknown) => T | undefined;

// One release-coupled namespace: the list under a key no slug can take, each story by its slug.
const NAMESPACE = 'story' as const;
const LIST_KEY = '~list';

async function fetchReleased<T>(
  path: string,
  key: string,
  parse: Parse<T>,
  releaseIdOf: (value: T) => string,
  errorMessage: string,
  deps: StoryDataDeps,
): Promise<StoryFetchResult<T>> {
  const now = deps.now ?? Date.now;

  const readCache = async (degraded: boolean): Promise<StoryFetchResult<T> | undefined> => {
    const activeStamp = (await deps.releaseCache.getActiveStamp()) ?? '';
    const cached = await deps.releaseCache.read<unknown>(NAMESPACE, key, {
      activeStamp,
      degraded,
      now: now(),
    });
    if (!cached) return undefined;
    const value = parse(cached.value);
    if (!value) return undefined;
    return {
      status: 'ready',
      value,
      freshness: { source: 'cache', fetchedAt: cached.freshness.fetchedAt, degraded },
    };
  };

  if (!deps.connectivity.isOnline()) {
    return (await readCache(true)) ?? { status: 'offline-no-cache' };
  }

  try {
    const result = await deps.transport.readJson<unknown>(path);
    if (result.kind !== 'ok') {
      return (await readCache(false)) ?? { status: 'offline-no-cache' };
    }
    const value = parse(result.data);
    if (!value) return { status: 'error', message: errorMessage };
    try {
      const stamp = releaseIdOf(value) || 'unknown-release';
      await deps.releaseCache.applyReleaseStamp(stamp, now());
      await deps.releaseCache.write(NAMESPACE, key, result.data, {
        releaseStamp: stamp,
        fetchedAt: now(),
      });
    } catch {
      // Caching is a convenience tier, never a requirement for a successful render.
    }
    return {
      status: 'ready',
      value,
      freshness: { source: 'network', fetchedAt: now(), degraded: false },
    };
  } catch (err) {
    if (err instanceof TransportError && err.info.status === 404) {
      // Withdrawn and never-existed are the same answer; never keep showing a cached copy.
      try {
        await deps.store.delete(NAMESPACE, key);
      } catch {
        // ignore
      }
      return { status: 'not-found' };
    }
    return (await readCache(true)) ?? { status: 'error', message: errorMessage };
  }
}

const parseList: Parse<{
  readonly releaseId: string;
  readonly stories: readonly StoryListItemV1[];
}> = (raw) => {
  const parsed = storiesResponseV1Schema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
};

const parseStory: Parse<StoryV1> = (raw) => {
  const parsed = storyV1Schema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
};

export function fetchStoryList(deps: StoryDataDeps) {
  return fetchReleased(
    '/v1/stories',
    LIST_KEY,
    parseList,
    (value) => value.releaseId,
    'Couldn’t load the stories. Check your connection and try again.',
    deps,
  );
}

export function fetchStory(slug: string, deps: StoryDataDeps) {
  return fetchReleased(
    `/v1/stories/${encodeURIComponent(slug)}`,
    slug,
    parseStory,
    (value) => value.releaseId,
    'Couldn’t load this story. Check your connection and try again.',
    deps,
  );
}

/** Collection members on the phone, in the collection's own order. */
export function collectionMembers(
  stories: readonly StoryListItemV1[],
  collectionId: string,
): readonly StoryListItemV1[] {
  return stories
    .filter((story) => story.collection?.id === collectionId)
    .sort(
      (a, b) =>
        (a.collection?.position ?? 0) - (b.collection?.position ?? 0) ||
        a.slug.localeCompare(b.slug),
    );
}
