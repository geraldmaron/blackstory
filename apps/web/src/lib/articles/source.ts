/**
 * Article read routing: active-release Postgres articles only. Mirrors the
 * theme-impact source contract — when the release read path is unavailable the
 * caller receives an explicit `unavailable` source and renders a degraded state
 * instead of stale substitute content.
 *
 * The whole article list (~48 docs, ~220KB) is one release-scoped read shared across
 * requests (see `release-scoped-cache.ts`). Every surface that used to issue its own query
 * per render — the `/stories` index, the cites edge on every record page and the Atlas
 * catalog, the story lead on `/` and `/place`, the by-slug detail read — is now a lookup over
 * that one cached list. Before this (pg_stat_statements, 2026-07-20 → 2026-09-02) the list
 * query had run 478k times: once per dynamic request, with only per-request memoisation.
 *
 * A detail read composes three readers: the article doc, the theme-impact
 * packets its data blocks reference (by packet id), and the entities its map
 * insets pin. Hydration folds them into renderable blocks and one reference
 * list via `hydrateArticle`.
 */
import { cache } from 'react';
import {
  publicArticleListItemSchema,
  type PublicArticleListItemDoc,
  type PublicArticleProjectionDoc,
} from '@repo/schemas';
import { themeImpactPacketToView, type ThemeImpactPacketView } from '@repo/domain';
import type { PublicEntityView } from '../../data/public-seed';
import { hasPostgresConnection } from '../public-data/live-policy';
import { createReleaseScopedCache } from '../public-data/release-scoped-cache';
import { getPublicActiveReleaseMeta, listPublicEntityViewsByIds } from '../public-data/source';
import { listThemeImpactPacketsByIds } from '../theme-impact/source';
import { buildCitesEdge, type CitesEdgeIndex } from '../release/build-cites-edge';
import { fetchReleaseArticle, listReleaseArticles } from './postgres-readers';
import {
  articleMapEntityIds,
  articlePacketIds,
  hydrateArticle,
  type HydratedArticle,
} from './hydrate';

export type ArticleReadSource = 'live' | 'unavailable';

function shouldAttemptLiveReads(): boolean {
  return hasPostgresConnection();
}

function logReadFailure(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[articles] ${context} failed; rendering unavailable state: ${message}`);
}

const releaseArticlesCache = createReleaseScopedCache<readonly PublicArticleProjectionDoc[]>({
  kind: 'release-articles-v1',
});

/**
 * Every article in the active release. Cross-request cached when there is an active-release
 * pointer to key on; a direct per-request read otherwise (seed mode, or the pointer read
 * failed — never a reason to serve nothing). Throws on read failure: the exported readers
 * below own the degraded state.
 */
const listReleaseArticlesCached = cache(
  async (): Promise<readonly PublicArticleProjectionDoc[]> => {
    const release = await getPublicActiveReleaseMeta();
    if (!release) return listReleaseArticles();
    return (await releaseArticlesCache.get(release, listReleaseArticles)) ?? [];
  },
);

export const listPublicArticleListItems = cache(
  async (): Promise<{
    readonly items: readonly PublicArticleListItemDoc[];
    readonly source: ArticleReadSource;
  }> => {
    if (!shouldAttemptLiveReads()) return { items: [], source: 'unavailable' };
    try {
      const docs = await listReleaseArticlesCached();
      const items = docs.map((doc) => publicArticleListItemSchema.parse(doc));
      return { items, source: 'live' };
    } catch (error) {
      logReadFailure('listReleaseArticles', error);
      return { items: [], source: 'unavailable' };
    }
  },
);

/**
 * One article by slug. Served from the cached release list; the point read is the fallback for
 * a slug the (up to 30 minutes stale) list does not know yet, so a freshly published story is
 * reachable before the list refreshes.
 */
async function readArticleBySlug(slug: string): Promise<PublicArticleProjectionDoc | undefined> {
  const fromList = (await listReleaseArticlesCached()).find((doc) => doc.slug === slug);
  if (fromList) return fromList;
  return fetchReleaseArticle(slug);
}

export const resolveArticle = cache(
  async (
    slug: string,
  ): Promise<
    | { readonly source: 'live'; readonly article: HydratedArticle }
    | { readonly source: 'live'; readonly article: null }
    | { readonly source: 'unavailable'; readonly article: null }
  > => {
    if (!shouldAttemptLiveReads()) return { source: 'unavailable', article: null };
    try {
      const doc = await readArticleBySlug(slug);
      if (!doc) return { source: 'live', article: null };
      const [packets, entities] = await Promise.all([
        loadPacketViews(articlePacketIds(doc)),
        loadEntities(articleMapEntityIds(doc)),
      ]);
      return { source: 'live', article: hydrateArticle(doc, packets, entities) };
    } catch (error) {
      logReadFailure(`resolveArticle(${slug})`, error);
      return { source: 'unavailable', article: null };
    }
  },
);

async function loadPacketViews(
  packetIds: readonly string[],
): Promise<readonly ThemeImpactPacketView[]> {
  if (packetIds.length === 0) return [];
  const packets = await listThemeImpactPacketsByIds(packetIds);
  return packets.map((packet) => themeImpactPacketToView(packet, { dataSource: 'live' }));
}

async function loadEntities(entityIds: readonly string[]): Promise<readonly PublicEntityView[]> {
  if (entityIds.length === 0) return [];
  const { data } = await listPublicEntityViewsByIds([...entityIds]);
  return data;
}

/**
 * The chapter-cites-record index for the active release.
 *
 * `cache()`-wrapped because every record surface in a render wants it (the Atlas sheet for the
 * whole catalog, `/entity/[id]` for one record); the underlying article list is the shared
 * cross-request read above, so this costs a fold over ~48 docs, not a query. Degrades to an
 * empty index rather than throwing: a record page whose chapter list is missing is worse than
 * ideal, a record page that 500s because the article table is unreachable is unacceptable.
 */
export const resolveCitesEdgeIndex = cache(async (): Promise<CitesEdgeIndex> => {
  if (!shouldAttemptLiveReads()) return {};
  try {
    return buildCitesEdge(await listReleaseArticlesCached());
  } catch (error) {
    logReadFailure('resolveCitesEdgeIndex', error);
    return {};
  }
});

/** Slugs of every published article, for `generateStaticParams`. */
export async function listPublishedArticleSlugs(): Promise<readonly string[]> {
  const { items } = await listPublicArticleListItems();
  return items.map((item) => item.slug);
}

export type { PublicArticleProjectionDoc };
