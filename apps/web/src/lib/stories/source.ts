/**
 * Story read routing: active-release Postgres stories only. Mirrors the
 * theme-impact source contract — when the release read path is unavailable the
 * caller receives an explicit `unavailable` source and renders a degraded state
 * instead of stale substitute content.
 *
 * The whole story list is one release-scoped read shared across requests (see
 * `release-scoped-cache.ts`). The `/stories` index, record-page citation edges, Explore catalog,
 * story leads, and by-slug detail reads all filter that cached list instead of issuing separate
 * list queries.
 *
 * A detail read composes three readers: the story doc, the theme-impact
 * packets its data blocks reference (by packet id), and the entities its map
 * insets pin. Hydration folds them into renderable blocks and one reference
 * list via `hydrateStory`.
 */
import { cache } from 'react';
import {
  publicStoryListItemSchema,
  type PublicStoryListItemDoc,
  type PublicStoryProjectionDoc,
} from '@repo/schemas';
import { themeImpactPacketToView, type ThemeImpactPacketView } from '@repo/domain';
import type { PublicEntityView } from '../../data/public-seed';
import { hasPostgresConnection } from '../public-data/live-policy';
import { createReleaseScopedCache } from '../public-data/release-scoped-cache';
import { getPublicActiveReleaseMeta, listPublicEntityViewsByIds } from '../public-data/source';
import { listThemeImpactPacketsByIds } from '../theme-impact/source';
import { buildCitesEdge, type CitesEdgeIndex } from '../release/build-cites-edge';
import { fetchReleaseStory, listReleaseStories } from './postgres-readers';
import { storyMapEntityIds, storyPacketIds, hydrateStory, type HydratedStory } from './hydrate';

export type StoryReadSource = 'live' | 'unavailable';

function shouldAttemptLiveReads(): boolean {
  return hasPostgresConnection();
}

function logReadFailure(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[stories] ${context} failed; rendering unavailable state: ${message}`);
}

const releaseStoriesCache = createReleaseScopedCache<readonly PublicStoryProjectionDoc[]>({
  kind: 'release-stories-v1',
});

/**
 * Every story in the active release. Cross-request cached when there is an active-release
 * pointer to key on; a direct per-request read otherwise (seed mode, or the pointer read
 * failed — never a reason to serve nothing). Throws on read failure: the exported readers
 * below own the degraded state.
 */
const listReleaseStoriesCached = cache(async (): Promise<readonly PublicStoryProjectionDoc[]> => {
  const release = await getPublicActiveReleaseMeta();
  if (!release) return listReleaseStories();
  return (await releaseStoriesCache.get(release, listReleaseStories)) ?? [];
});

export const listPublicStoryListItems = cache(
  async (): Promise<{
    readonly items: readonly PublicStoryListItemDoc[];
    readonly source: StoryReadSource;
  }> => {
    if (!shouldAttemptLiveReads()) return { items: [], source: 'unavailable' };
    try {
      const docs = await listReleaseStoriesCached();
      const items = docs.map((doc) => publicStoryListItemSchema.parse(doc));
      return { items, source: 'live' };
    } catch (error) {
      logReadFailure('listReleaseStories', error);
      return { items: [], source: 'unavailable' };
    }
  },
);

/**
 * One story by slug. Served from the cached release list; the point read is the fallback for
 * a slug the (up to 30 minutes stale) list does not know yet, so a freshly published story is
 * reachable before the list refreshes.
 */
async function readStoryBySlug(slug: string): Promise<PublicStoryProjectionDoc | undefined> {
  const fromList = (await listReleaseStoriesCached()).find((doc) => doc.slug === slug);
  if (fromList) return fromList;
  return fetchReleaseStory(slug);
}

export const resolveStory = cache(
  async (
    slug: string,
  ): Promise<
    | { readonly source: 'live'; readonly story: HydratedStory }
    | { readonly source: 'live'; readonly story: null }
    | { readonly source: 'unavailable'; readonly story: null }
  > => {
    if (!shouldAttemptLiveReads()) return { source: 'unavailable', story: null };
    try {
      const doc = await readStoryBySlug(slug);
      if (!doc) return { source: 'live', story: null };
      const [packets, entities] = await Promise.all([
        loadPacketViews(storyPacketIds(doc)),
        loadEntities(storyMapEntityIds(doc)),
      ]);
      return { source: 'live', story: hydrateStory(doc, packets, entities) };
    } catch (error) {
      logReadFailure(`resolveStory(${slug})`, error);
      return { source: 'unavailable', story: null };
    }
  },
);

/**
 * Every story in one collection, hydrated, in collection order. Lives uses this to read a column's era
 * narratives. Degrades to an empty list: a Lives page without its prose still has its figures and
 * rules, while one that throws has nothing.
 */
export const resolveStoryCollection = cache(
  async (collectionId: string): Promise<readonly HydratedStory[]> => {
    if (!shouldAttemptLiveReads()) return [];
    try {
      const docs = (await listReleaseStoriesCached())
        .filter((doc) => doc.collection?.id === collectionId)
        .sort((a, b) => (a.collection?.position ?? 0) - (b.collection?.position ?? 0));
      return await Promise.all(
        docs.map(async (doc) => {
          const [packets, entities] = await Promise.all([
            loadPacketViews(storyPacketIds(doc)),
            loadEntities(storyMapEntityIds(doc)),
          ]);
          return hydrateStory(doc, packets, entities);
        }),
      );
    } catch (error) {
      logReadFailure(`resolveStoryCollection(${collectionId})`, error);
      return [];
    }
  },
);

export async function loadPacketViews(
  packetIds: readonly string[],
): Promise<readonly ThemeImpactPacketView[]> {
  if (packetIds.length === 0) return [];
  const packets = await listThemeImpactPacketsByIds(packetIds);
  return packets.map((packet) => themeImpactPacketToView(packet, { dataSource: 'live' }));
}

export async function loadEntities(
  entityIds: readonly string[],
): Promise<readonly PublicEntityView[]> {
  if (entityIds.length === 0) return [];
  const { data } = await listPublicEntityViewsByIds([...entityIds]);
  return data;
}

/**
 * The chapter-cites-record index for the active release.
 *
 * `cache()`-wrapped because every record surface in a render wants it (the Explore sheet for the
 * whole catalog, `/entity/[id]` for one record); the underlying story list is the shared
 * cross-request read above, so this costs a fold over ~48 docs, not a query. Degrades to an
 * empty index rather than throwing: a record page whose chapter list is missing is worse than
 * ideal, a record page that 500s because the story table is unreachable is unacceptable.
 */
export const resolveCitesEdgeIndex = cache(async (): Promise<CitesEdgeIndex> => {
  if (!shouldAttemptLiveReads()) return {};
  try {
    return buildCitesEdge(await listReleaseStoriesCached());
  } catch (error) {
    logReadFailure('resolveCitesEdgeIndex', error);
    return {};
  }
});

/** Slugs of every published story, for `generateStaticParams`. */
export async function listPublishedStorySlugs(): Promise<readonly string[]> {
  const { items } = await listPublicStoryListItems();
  return items.map((item) => item.slug);
}

export type { PublicStoryProjectionDoc };
