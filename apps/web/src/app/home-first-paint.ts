/**
 * Place-page loader for `/place/[slug]`: one published place, never the 4,101 catalog.
 *
 * Live reads are point-gets (`resolvePublicEntityView`). Seed reads the Dunbar cluster.
 * Greenwood is last-resort fallback when no other place can be resolved. Internal ids
 * never title and never appear in the address a reader follows.
 */
import { listPublicArticleListItems, resolveCitesEdgeIndex } from '../lib/articles/source';
import { shouldUseLivePublicProjections } from '../lib/public-data/live-policy';
import { resolvePublicEntityView } from '../lib/public-data/source';
import { getPublicEntity, listPublicEntities, type PublicEntityView } from '../data/public-seed';
import {
  canStandHere,
  isInternalRecordLabel,
  isTulsaPlace,
  publicPlaceSlug,
} from '../lib/place/public-place-path';
import { storiesCiting, type StoryCitation } from '../lib/release/build-cites-edge';
import { pickLeadStory } from './stories/stories-index';
import type { PublicArticleListItemDoc } from '@repo/schemas';

export { isInternalRecordLabel } from '../lib/place/public-place-path';

/**
 * Places that hold, in stand order. Non-Tulsa first. Greenwood is last-resort
 * fallback when no other published place can be resolved.
 */
export const HOME_STAND_CANDIDATE_IDS = [
  'ent_aarlcc_fort_lauderdale_001',
  'nrhp-black-heritage-91000107',
  'nrhp-black-heritage-100001861',
  'ent_dunbar_school_001',
  'ent_15th_st_church_001',
  'ent_greenwood_district_001',
] as const;

/** @deprecated Use HOME_STAND_CANDIDATE_IDS. */
export const HOME_FEATURED_ENTITY_IDS = HOME_STAND_CANDIDATE_IDS;

export type HomeFirstPaintSource = 'live' | 'seed' | 'none';

export type HomeFirstPaintModel = {
  readonly lead: PublicEntityView | undefined;
  readonly also: readonly PublicEntityView[];
  readonly story: PublicArticleListItemDoc | undefined;
  readonly citing: readonly StoryCitation[];
  readonly source: HomeFirstPaintSource;
};

export type LoadHomeFirstPaintOptions = {
  readonly namedSlug?: string;
  /** When true, do not fall back to another place if the named slug misses. */
  readonly requireNamed?: boolean;
};

function stands(entity: PublicEntityView): boolean {
  return canStandHere(entity);
}

async function readById(id: string): Promise<{
  readonly lead: PublicEntityView | undefined;
  readonly source: HomeFirstPaintSource;
}> {
  if (shouldUseLivePublicProjections()) {
    try {
      const resolved = await resolvePublicEntityView(id);
      if (resolved.data && stands(resolved.data)) {
        return { lead: resolved.data, source: 'live' };
      }
    } catch {
      // A failed point-get must not become a 4,101-row catalog pull.
    }
  }
  const seeded = getPublicEntity(id);
  if (seeded && stands(seeded)) return { lead: seeded, source: 'seed' };
  return { lead: undefined, source: 'none' };
}

function seedBySlug(slug: string): PublicEntityView | undefined {
  return listPublicEntities().find((entity) => publicPlaceSlug(entity.displayName) === slug);
}

async function readBySlug(slug: string): Promise<{
  readonly lead: PublicEntityView | undefined;
  readonly source: HomeFirstPaintSource;
}> {
  const trimmed = slug.trim();
  if (trimmed.length === 0 || isInternalRecordLabel(trimmed) || trimmed.startsWith('ent_')) {
    return { lead: undefined, source: 'none' };
  }

  const seeded = seedBySlug(trimmed);
  if (seeded && stands(seeded)) {
    if (!shouldUseLivePublicProjections()) return { lead: seeded, source: 'seed' };
  }

  for (const id of HOME_STAND_CANDIDATE_IDS) {
    const resolved = await readById(id);
    if (resolved.lead && publicPlaceSlug(resolved.lead.displayName) === trimmed) {
      return resolved;
    }
  }

  if (seeded && stands(seeded)) return { lead: seeded, source: 'seed' };
  return { lead: undefined, source: 'none' };
}

async function readStandablePlaces(): Promise<
  readonly { readonly entity: PublicEntityView; readonly source: HomeFirstPaintSource }[]
> {
  const out: { entity: PublicEntityView; source: HomeFirstPaintSource }[] = [];
  const seen = new Set<string>();
  for (const id of HOME_STAND_CANDIDATE_IDS) {
    const resolved = await readById(id);
    if (!resolved.lead || seen.has(resolved.lead.id)) continue;
    seen.add(resolved.lead.id);
    out.push({ entity: resolved.lead, source: resolved.source });
  }
  return out;
}

function alsoFromStands(
  lead: PublicEntityView | undefined,
  candidates: readonly PublicEntityView[],
): PublicEntityView[] {
  const leadId = lead?.id;
  const leadSlug = lead ? publicPlaceSlug(lead.displayName) : '';
  return candidates.filter((entity) => {
    if (entity.id === leadId) return false;
    if (publicPlaceSlug(entity.displayName) === leadSlug) return false;
    return !isTulsaPlace(entity);
  });
}

export function pickHomeStory(
  items: readonly PublicArticleListItemDoc[],
): PublicArticleListItemDoc | undefined {
  const publishable = items.filter((item) => !isInternalRecordLabel(item.title));
  return pickLeadStory(publishable);
}

export async function loadHomeFirstPaint(
  options: LoadHomeFirstPaintOptions = {},
): Promise<HomeFirstPaintModel> {
  const [articles, cites, standRows] = await Promise.all([
    listPublicArticleListItems(),
    resolveCitesEdgeIndex(),
    readStandablePlaces(),
  ]);

  const named = options.namedSlug?.trim();
  let lead: PublicEntityView | undefined;
  let source: HomeFirstPaintSource = 'none';

  if (named) {
    const fromStands = standRows.find(
      (row) => publicPlaceSlug(row.entity.displayName) === named,
    );
    if (fromStands) {
      lead = fromStands.entity;
      source = fromStands.source;
    } else {
      const resolved = await readBySlug(named);
      if (resolved.lead) {
        lead = resolved.lead;
        source = resolved.source;
      } else if (options.requireNamed) {
        return {
          lead: undefined,
          also: [],
          story: undefined,
          citing: [],
          source: 'none',
        };
      }
    }
  }

  if (!lead) {
    const away = standRows.find((row) => !isTulsaPlace(row.entity));
    const pick = away ?? standRows[0];
    if (pick) {
      lead = pick.entity;
      source = pick.source;
    }
  }

  const story =
    articles.source === 'live' && articles.items.length > 0
      ? pickHomeStory(articles.items)
      : undefined;
  const citing = lead ? storiesCiting(cites, lead.id) : [];
  return {
    lead,
    also: alsoFromStands(
      lead,
      standRows.map((row) => row.entity),
    ),
    story,
    citing,
    source,
  };
}
