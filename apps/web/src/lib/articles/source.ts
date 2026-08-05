/**
 * Article read routing: active-release Postgres articles only. Mirrors the
 * theme-impact source contract — when the release read path is unavailable the
 * caller receives an explicit `unavailable` source and renders a degraded state
 * instead of stale substitute content.
 *
 * A detail read composes three live readers: the article doc, the theme-impact
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
import { listPublicEntityViewsByIds } from '../public-data/source';
import { listReleaseThemeImpactPacketsByIds } from '../theme-impact/postgres-readers';
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

export const listPublicArticleListItems = cache(
  async (): Promise<{
    readonly items: readonly PublicArticleListItemDoc[];
    readonly source: ArticleReadSource;
  }> => {
    if (!shouldAttemptLiveReads()) return { items: [], source: 'unavailable' };
    try {
      const docs = await listReleaseArticles();
      const items = docs.map((doc) => publicArticleListItemSchema.parse(doc));
      return { items, source: 'live' };
    } catch (error) {
      logReadFailure('listReleaseArticles', error);
      return { items: [], source: 'unavailable' };
    }
  },
);

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
      const doc = await fetchReleaseArticle(slug);
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
  const packets = await listReleaseThemeImpactPacketsByIds(packetIds);
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
 * whole catalog, `/entity/[id]` for one record) and it is one full-body article read. Degrades to
 * an empty index rather than throwing: a record page whose chapter list is missing is worse than
 * ideal, a record page that 500s because the article table is unreachable is unacceptable.
 */
export const resolveCitesEdgeIndex = cache(async (): Promise<CitesEdgeIndex> => {
  if (!shouldAttemptLiveReads()) return {};
  try {
    return buildCitesEdge(await listReleaseArticles());
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
