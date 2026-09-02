/**
 * `GET /door/photos` — opaque Door pin id (`pin-N`) → pin photo, for every Door pin whose entity
 * carries a rights-cleared `primaryImage`.
 *
 * A second, smaller endpoint rather than the Door reusing `GET /atlas/photos` directly: that
 * route is keyed by real entity id, and `first-paint-pins.ts` treats entity ids (`ent_*`) as a
 * shop token that must never reach a Door client — the whole reason `/door/pin/[pinId]` exists is
 * to resolve a click without ever printing one. A Door pin's DOM only ever carries its opaque
 * `pin-N`, so a hover/focus lookup needs a photo map keyed the same way. `buildDoorPinPhotoIndex`
 * (`entity-photo-index.ts`) builds it from the same `buildEntityPhotoIndex` `/atlas/photos` uses —
 * one reliable-photo-set definition — joined against the already-cached Door pin plate's feature
 * order, so no real entity id is ever serialized into this response.
 */
import { getSharedPublicEntities } from '../../../lib/map-experience/shared-map-data';
import {
  DOOR_PIN_REDIRECT_CACHE_CONTROL,
  loadDoorPinPlate,
} from '../../../lib/map-experience/door-catalog';
import { buildDoorPinPhotoIndex } from '../../../lib/map-experience/entity-photo-index';
import { firstPaintPinId } from '../../../lib/map-experience/first-paint-pins';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const [{ data: entities }, { features }] = await Promise.all([
    getSharedPublicEntities(),
    loadDoorPinPlate(),
  ]);
  const index = buildDoorPinPhotoIndex(entities, features, firstPaintPinId);

  return new Response(JSON.stringify(index), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': DOOR_PIN_REDIRECT_CACHE_CONTROL,
      // Data for the Door pin field, not a page. Nothing to index.
      'X-Robots-Tag': 'noindex',
    },
  });
}
