/**
 * Featured first paint for `/`: one published record, never the release-wide catalog.
 *
 * Live reads the entity the same way `/entity/[id]` does (`resolvePublicEntityView`).
 * That is a point-get, not a catalog pull. Seed mode reads the Dunbar cluster so CI
 * still paints a place when Greenwood is not in the fixture. Internal ids never title.
 */
import { listPublicArticleListItems } from '../lib/articles/source';
import { shouldUseLivePublicProjections } from '../lib/public-data/live-policy';
import { resolvePublicEntityView } from '../lib/public-data/source';
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

async function loadLeadRecord(): Promise<{
  readonly lead: PublicEntityView | undefined;
  readonly source: HomeFirstPaintSource;
}> {
  if (shouldUseLivePublicProjections()) {
    for (const id of HOME_FEATURED_ENTITY_IDS) {
      try {
        const resolved = await resolvePublicEntityView(id);
        if (resolved.data && !isInternalRecordLabel(resolved.data.displayName)) {
          return { lead: resolved.data, source: 'live' };
        }
      } catch {
        // A failed point-get must not become a 4,101-row catalog pull.
      }
    }
    return { lead: undefined, source: 'none' };
  }

  for (const id of HOME_FEATURED_ENTITY_IDS) {
    const seeded = getPublicEntity(id);
    if (seeded && !isInternalRecordLabel(seeded.displayName)) {
      return { lead: seeded, source: 'seed' };
    }
  }
  return { lead: undefined, source: 'none' };
}

export async function loadHomeFirstPaint(): Promise<HomeFirstPaintModel> {
  const [{ lead, source }, articles] = await Promise.all([
    loadLeadRecord(),
    listPublicArticleListItems(),
  ]);
  const story =
    articles.source === 'live' && articles.items.length > 0
      ? pickHomeStory(articles.items)
      : undefined;
  return { lead, also: [], story, source };
}
