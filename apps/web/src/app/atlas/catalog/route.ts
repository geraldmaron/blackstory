/**
 * `GET /atlas/catalog` — the release-wide half of the Explore view model as JSON, CDN-cached.
 *
 * Dynamic on purpose: a statically rendered route handler would be built at `next build`, and the
 * `Build and Typecheck` CI job builds without database secrets (the same constraint that keeps
 * `/rooms` dynamic). Being dynamic does not stop the CDN from caching it: the no-store that
 * Next forces onto dynamic *pages* does not apply to a route handler that sets its own
 * `Cache-Control`, which is the whole reason the catalog moved here from `/`. See
 * `explore/atlas-catalog.ts` for the cost history.
 */
import { getSharedPublicEntities } from '../../../lib/map-experience/shared-map-data';
import { ATLAS_CATALOG_CACHE_CONTROL, buildAtlasCatalogJson } from '../../explore/atlas-catalog';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const { data: entities, source } = await getSharedPublicEntities();
  const body = await buildAtlasCatalogJson(entities, source);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': ATLAS_CATALOG_CACHE_CONTROL,
      // Data for Explore, not a page. Nothing to index.
      'X-Robots-Tag': 'noindex',
    },
  });
}
