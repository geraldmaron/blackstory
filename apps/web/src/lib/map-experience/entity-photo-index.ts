/**
 * The reliable photo set: which entities in the active release carry a rights-cleared image, and
 * the small view of it a pin card needs. Shared by `GET /atlas/photos` (entity-id keyed, for
 * Explore) and `GET /door/photos` (pin-id keyed, for the Door — see that route's module comment for
 * why it stays a second, smaller endpoint instead of reusing this one's keys).
 *
 * The set today (WS6): every entity carrying `projection.primaryImage` — currently the existing
 * hand/pipeline-curated set (235), Wikidata P18 for entities with a stored QID (up to 484), and
 * NRHP place listings resolved via Wikidata P649→P18 (Wikidata carries a photo for roughly 86% of
 * NRHP items). Places reach a pin at all only when pinned through the WS5 pin script run with
 * `--allow-places`. This module does not compute that set — it only reads whatever
 * `primaryImage` the release projection already carries — so the reliable set grows exactly as
 * fast as the enrichment/pin pipelines populate that field, with no second definition to keep in
 * sync here.
 */
import { pinThumbnailUrl } from './pin-thumbnail-url';
import type { PublicEntityView } from '../../data/public-seed';
import { isRenderedImage } from '../../components/entity/rendered-image';
// Server only from here on: the record page's quiet rule reaches @repo/domain. Client code takes
// this module's types, and `pinThumbnailUrl` from its own module.
import { isQuietRecord } from '../../app/entity/[id]/adapters';

export { pinThumbnailUrl };

/** 480px matches the pin card's rendered width at 2x DPR without shipping the source scan. */
export const PIN_PHOTO_THUMBNAIL_WIDTH = 480;

/** What a pin card needs to show a photo — never the full `PublicEntityPrimaryImageView`
 * (no `objectPath`, no raw `rightsStatus` enum) so the payload stays exactly this shape. */
export type PinPhotoView = {
  readonly url: string;
  readonly alt: string;
  readonly credit: string;
  readonly license?: string;
  readonly sourcePageUrl?: string;
};

function toPinPhotoView(image: NonNullable<PublicEntityView['primaryImage']>): PinPhotoView {
  return {
    url: pinThumbnailUrl(image.url, PIN_PHOTO_THUMBNAIL_WIDTH),
    alt: image.alt,
    credit: image.credit,
  };
}

/** The most ids one `?ids=` request may name; more is a caller bug, not a bigger answer. */
export const MAX_PHOTO_IDS = 100;

/**
 * The part of a photo index a `?ids=a,b,c` request names (`usePhotos`). With no `ids` parameter
 * the whole index is the answer.
 */
export function pickPhotoIds(
  index: Readonly<Record<string, PinPhotoView>>,
  url: string,
): Readonly<Record<string, PinPhotoView>> {
  const raw = new URL(url).searchParams.get('ids');
  if (raw === null) return index;
  // Built from entries, never by writing a caller-named key onto an object.
  return Object.fromEntries(
    raw
      .split(',')
      .slice(0, MAX_PHOTO_IDS)
      .flatMap((id) => (Object.hasOwn(index, id) && index[id] ? [[id, index[id]]] : [])),
  );
}

/** Entity id → pin photo, for every entity in `entities` that carries a showable `primaryImage`. */
export function buildEntityPhotoIndex(
  entities: readonly PublicEntityView[],
): Readonly<Record<string, PinPhotoView>> {
  const index: Record<string, PinPhotoView> = {};
  for (const entity of entities) {
    // A quiet record keeps its photograph on its own page only, and a rendering is never shown
    // as a photograph (docs/ui/archive/patterns-living-archive.md, Plates).
    if (!entity.primaryImage || isQuietRecord(entity) || isRenderedImage(entity.primaryImage)) {
      continue;
    }
    index[entity.id] = toPinPhotoView(entity.primaryImage);
  }
  return index;
}

/**
 * Opaque Door pin id → pin photo. `features` is the Door pin plate's real-entity-id feature list
 * (`door-catalog.ts`'s `DoorPinPlateCache.features`, index-aligned with `firstPaintPinId`); this
 * joins it against `buildEntityPhotoIndex`'s output without ever placing a real entity id in the
 * returned record — only `pinIdFor(index)` keys survive into it. Pulled out as a pure function
 * (rather than inlined in the route) so it stays testable without Next's `unstable_cache`/`cache`
 * runtime, matching `door-catalog.test.ts`'s existing pattern for this file's other pure helpers.
 */
export function buildDoorPinPhotoIndex(
  entities: readonly PublicEntityView[],
  features: readonly { readonly properties: { readonly entityId: string } }[],
  pinIdFor: (index: number) => string,
): Readonly<Record<string, PinPhotoView>> {
  const photoByEntityId = buildEntityPhotoIndex(entities);
  const index: Record<string, PinPhotoView> = {};
  features.forEach((feature, i) => {
    const photo = photoByEntityId[feature.properties.entityId];
    if (photo) index[pinIdFor(i)] = photo;
  });
  return index;
}
