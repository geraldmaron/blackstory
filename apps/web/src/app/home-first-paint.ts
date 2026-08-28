/**
 * Featured first paint for `/`: a small, already-released set, never the whole catalog.
 *
 * Live reads go through `listPublicEntityViewsByIds` (thin point-get). When live projections
 * are off (CI, seed mode) the Dunbar seed ids are read from the bundled cluster so the door
 * still paints a place. That is not a catalog fallback. Internal ids never become titles.
 */
import { listPublicArticleListItems } from '../lib/articles/source';
import { shouldUseLivePublicProjections } from '../lib/public-data/live-policy';
import { listPublicEntityViewsByIds } from '../lib/public-data/source';
import { getPublicEntity, type PublicEntityView } from '../data/public-seed';
import { pickLeadStory } from './stories/stories-index';
import type { PublicArticleListItemDoc } from '@repo/schemas';

/**
 * Greenwood (Tulsa) first: a live published place. Dunbar and 15th Street are the seed
 * cluster so CI/seed still paints a place when Greenwood is not in the fixture.
 */
export const HOME_FEATURED_ENTITY_IDS = [
  'ent_greenwood_district_001',
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

const TULSA_STORY = /tulsa|greenwood|black wall street/i;

/**
 * Opaque catalog tokens must never title first paint. `42Cb1758` is the live fail:
 * it is not a published record (`/records/42Cb1758` 404s) and it is not a story.
 */
export function isInternalRecordLabel(value: string | undefined): boolean {
  if (value === undefined) return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  if (/^(ent|disc|art|pkg|rec|src)_/i.test(trimmed)) return true;
  return (
    !/\s/.test(trimmed) &&
    /^[A-Za-z0-9_-]{6,32}$/.test(trimmed) &&
    /\d/.test(trimmed) &&
    /[A-Za-z]/.test(trimmed)
  );
}

function publishableEntities(entities: readonly PublicEntityView[]): readonly PublicEntityView[] {
  return entities.filter((entity) => !isInternalRecordLabel(entity.displayName));
}

function orderFeatured(entities: readonly PublicEntityView[]): readonly PublicEntityView[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity] as const));
  const ordered: PublicEntityView[] = [];
  for (const id of HOME_FEATURED_ENTITY_IDS) {
    const hit = byId.get(id);
    if (hit) ordered.push(hit);
  }
  return publishableEntities(ordered);
}

export function pickHomeStory(
  items: readonly PublicArticleListItemDoc[],
): PublicArticleListItemDoc | undefined {
  const publishable = items.filter((item) => !isInternalRecordLabel(item.title));
  const tulsa = publishable.find((item) =>
    TULSA_STORY.test(
      [item.title, item.summary, item.placeLabel, item.slug, ...(item.tags ?? [])].join(' '),
    ),
  );
  return tulsa ?? pickLeadStory(publishable);
}

async function loadFeaturedEntities(): Promise<{
  readonly entities: readonly PublicEntityView[];
  readonly source: HomeFirstPaintSource;
}> {
  if (shouldUseLivePublicProjections()) {
    try {
      const live = await listPublicEntityViewsByIds([...HOME_FEATURED_ENTITY_IDS]);
      const ordered = orderFeatured(live.data);
      if (ordered.length > 0) {
        return { entities: ordered, source: 'live' };
      }
    } catch {
      // A failed thin read must not become a 4,101-row catalog pull.
    }
    return { entities: [], source: 'none' };
  }

  const seeded = HOME_FEATURED_ENTITY_IDS.map((id) => getPublicEntity(id)).filter(
    (entity): entity is PublicEntityView => entity !== undefined,
  );
  const ordered = orderFeatured(seeded);
  return { entities: ordered, source: ordered.length > 0 ? 'seed' : 'none' };
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
      ? pickHomeStory(articles.items)
      : undefined;
  return { lead, also, story, source };
}
