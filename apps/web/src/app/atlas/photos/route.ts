/**
 * `GET /atlas/photos` — entity id → pin photo, for every entity in the active release that
 * carries a rights-cleared `primaryImage`. Same shape and cost profile as `GET /atlas/catalog`
 * (`atlas-catalog.ts`): dynamic route handler with its own `Cache-Control` so the CDN can still
 * cache a route Next would otherwise force to `no-store`.
 *
 * Explore asks for the ids it shows (`?ids=`, `usePhotos`): the rows in view, the inspected
 * record and the hovered pin, never the whole index. See `entity-photo-index.ts` for the
 * reliable-set definition.
 */
import { getSharedPublicEntities } from '../../../lib/map-experience/shared-map-data';
import {
  buildEntityPhotoIndex,
  pickPhotoIds,
} from '../../../lib/map-experience/entity-photo-index';
import { ATLAS_CATALOG_CACHE_CONTROL } from '../../explore/atlas-catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const { data: entities } = await getSharedPublicEntities();
  const index = buildEntityPhotoIndex(entities);
  return new Response(JSON.stringify(pickPhotoIds(index, request.url)), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': ATLAS_CATALOG_CACHE_CONTROL,
      // Data for Explore/Door, not a page. Nothing to index.
      'X-Robots-Tag': 'noindex',
    },
  });
}
