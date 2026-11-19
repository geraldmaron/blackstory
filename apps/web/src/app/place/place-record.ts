/**
 * Resolves one published place for `/place/{slug}`: one record, never the release-wide catalog.
 *
 * Live reads resolve the slug through the search index, then a point-get. Seed reads match the
 * slug against the bundled cluster. A collision address carries its id (`{slug}--{entityId}`).
 * A slug that resolves to nothing returns nothing; the page 404s rather than standing somewhere
 * else.
 */
import { cache } from 'react';
import { shouldUseLivePublicProjections } from '../../lib/public-data/live-policy';
import { getPublicSearchIndex, resolvePublicEntityView } from '../../lib/public-data/source';
import { getPublicEntity, listPublicEntities, type PublicEntityView } from '../../data/public-seed';
import {
  canStandHere,
  isInternalRecordLabel,
  PLACE_PAGE_STAND_IDS,
  publicPlaceSlug,
} from '../../lib/place/public-place-path';
import {
  isResolvablePlaceSlug,
  parsePlaceAddress,
  resolvePlaceSlugFromSearchIndex,
} from '../../lib/place/place-slug';

async function readById(id: string): Promise<PublicEntityView | undefined> {
  if (shouldUseLivePublicProjections()) {
    try {
      const resolved = await resolvePublicEntityView(id);
      if (resolved.data && canStandHere(resolved.data)) return resolved.data;
    } catch {
      // A failed point-get must not become a catalog pull; fall through to the seed.
    }
  }
  const seeded = getPublicEntity(id);
  return seeded && canStandHere(seeded) ? seeded : undefined;
}

/**
 * The published place at this slug, or undefined. Internal ids never title a page. Memoized per
 * request: the 404 gate, the metadata and the page all ask, and should read once.
 */
export const loadPlaceRecord = cache(
  async (slug: string): Promise<PublicEntityView | undefined> => {
    const trimmed = slug.trim();
    if (!isResolvablePlaceSlug(trimmed)) return undefined;
    const record = await resolve(trimmed);
    return record && !isInternalRecordLabel(record.displayName) ? record : undefined;
  },
);

async function resolve(slug: string): Promise<PublicEntityView | undefined> {
  const { base, entityId } = parsePlaceAddress(slug);
  if (entityId) return readById(entityId);

  if (shouldUseLivePublicProjections()) {
    try {
      const index = await getPublicSearchIndex();
      const resolvedId = resolvePlaceSlugFromSearchIndex(index.data, slug);
      if (resolvedId) {
        const lead = await readById(resolvedId);
        if (lead) return lead;
      }
    } catch {
      // Index miss: fall through to the seed and the stand ids, never to the catalog.
    }
  }

  const seeded = listPublicEntities().filter(
    (entity) => canStandHere(entity) && publicPlaceSlug(entity.displayName) === base,
  );
  if (seeded.length > 0) {
    return (
      seeded.find((entity) => (PLACE_PAGE_STAND_IDS as readonly string[]).includes(entity.id)) ??
      seeded[0]
    );
  }

  for (const id of PLACE_PAGE_STAND_IDS) {
    const lead = await readById(id);
    if (lead && publicPlaceSlug(lead.displayName) === base) return lead;
  }
  return undefined;
}
