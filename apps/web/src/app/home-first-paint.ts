/**
 * Featured first paint for `/`: a small, already-released set, never the whole catalog.
 *
 * Live reads go through `listPublicEntityViewsByIds` (thin point-get). When live projections
 * are off (CI, seed mode) the two featured seed ids are read from the bundled Dunbar cluster
 * so the door still paints a place. That is not a catalog fallback.
 */
import { listPublicArticleListItems } from '../lib/articles/source';
import { shouldUseLivePublicProjections } from '../lib/public-data/live-policy';
import { listPublicEntityViewsByIds } from '../lib/public-data/source';
import { getPublicEntity, type PublicEntityView } from '../data/public-seed';
import { pickLeadStory } from './stories/stories-index';
import type { PublicArticleListItemDoc } from '@repo/schemas';

/** Dunbar first: the place whose story is "what happened here." Church is the also-here card. */
export const HOME_FEATURED_ENTITY_IDS = [
  'ent_dunbar_school_001',
  'ent_15th_st_church_001',
] as const;

export type HomeFirstPaintSource = 'live' | 'seed' | 'none';

export type HomeFirstPaintModel = {
  readonly lead: PublicEntityView | undefined;
  readonly also: readonly PublicEntityView[];
  readonly story: PublicArticleListItemDoc | undefined;
  readonly source: HomeFirstPaintSource;
};

function orderFeatured(entities: readonly PublicEntityView[]): readonly PublicEntityView[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity] as const));
  const ordered: PublicEntityView[] = [];
  for (const id of HOME_FEATURED_ENTITY_IDS) {
    const hit = byId.get(id);
    if (hit) ordered.push(hit);
  }
  return ordered;
}

async function loadFeaturedEntities(): Promise<{
  readonly entities: readonly PublicEntityView[];
  readonly source: HomeFirstPaintSource;
}> {
  if (shouldUseLivePublicProjections()) {
    try {
      const live = await listPublicEntityViewsByIds([...HOME_FEATURED_ENTITY_IDS]);
      if (live.data.length > 0) {
        return { entities: orderFeatured(live.data), source: 'live' };
      }
    } catch {
      // A failed thin read must not become a 4,101-row catalog pull.
    }
    return { entities: [], source: 'none' };
  }

  const seeded = HOME_FEATURED_ENTITY_IDS.map((id) => getPublicEntity(id)).filter(
    (entity): entity is PublicEntityView => entity !== undefined,
  );
  return { entities: seeded, source: seeded.length > 0 ? 'seed' : 'none' };
}

export async function loadHomeFirstPaint(): Promise<HomeFirstPaintModel> {
  const [{ entities, source }, articles] = await Promise.all([
    loadFeaturedEntities(),
    listPublicArticleListItems(),
  ]);
  const lead = entities[0];
  const also = entities.slice(1);
  const story =
    articles.source === 'live' && articles.items.length > 0
      ? pickLeadStory(articles.items)
      : undefined;
  return { lead, also, story, source };
}
