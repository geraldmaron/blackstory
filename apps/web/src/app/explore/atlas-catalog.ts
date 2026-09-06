/**
 * The Explore catalog: the release-wide, reader-independent half of the Explore view model, served
 * by `GET /atlas/catalog` and fetched once by the client.
 *
 * Why this exists (Vercel bill, 2026-08-22). `/` used to render the whole thing into its own HTML
 * as the `initial` prop of `AtlasExperience`: 4,101 features plus the history edge catalog, ~15 MB
 * of RSC payload, ~4 s of CPU, on every request, and `/` is dynamic (it reads `searchParams`), so
 * none of it was cacheable by the CDN. That one route was the month's Fast Origin Transfer and
 * Fluid Active CPU. Nothing in this payload depends on the request: it is the same bytes for
 * every reader until the release changes. So it lives behind a route handler that sets its own
 * `Cache-Control` (route handlers keep theirs; dynamic pages have it overwritten with no-store)
 * and the page ships only the request-scoped shell (`AtlasShellModel`).
 *
 * Server-only: reaches the history graph seed (`node:crypto`) and the articles read. The
 * client-safe assembly of shell + catalog into a view model is in `explore-view-model-wire.ts`.
 */
import { resolveHistoryGraphReleaseArtifact } from '../../data/history-graph-seed';
import { listPublicEntities, type PublicEntityView } from '../../data/public-seed';
import { resolveCitesEdgeIndex } from '../../lib/articles/source';
import type { PublicReadSource } from '../../lib/public-data/source';
import type { CitesEdgeIndex } from '../../lib/release/build-cites-edge';
import { exploreMapSourceFor } from '../../lib/map-experience/build-explore-map-source';
import { buildUnmappedPaletteRecords } from '../../lib/map-experience/build-palette-records';
import { buildEdgeLineCatalog } from './explore-view-model';
import type { AtlasCatalogPayload } from './explore-view-model-wire';

export { ATLAS_CATALOG_PATH } from './explore-view-model-wire';

/**
 * What the CDN is told. `s-maxage` is the edge TTL (one hour, the same freshness bound
 * `/entity/[id]` already accepts); `stale-while-revalidate` lets a hit past the hour serve the
 * old copy while one request refreshes it, so a regional cache miss is still not a wait;
 * `max-age` lets the browser reuse it across client-side navigations back to `/` for a few
 * minutes. Vercel strips the CDN directives before the response reaches the browser.
 */
export const ATLAS_CATALOG_CACHE_CONTROL =
  'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

export function buildAtlasCatalogPayload(
  entities: readonly PublicEntityView[],
  artifact: Parameters<typeof buildEdgeLineCatalog>[0],
  citesEdge: CitesEdgeIndex,
  dataSource: PublicReadSource,
): AtlasCatalogPayload {
  const source = exploreMapSourceFor(entities);
  const { edgeLineCatalog, availableDecades } = buildEdgeLineCatalog(artifact, entities);
  const mappedEntityIds = new Set(
    source.featureCollection.features.map((feature) => feature.properties.entityId),
  );
  return {
    schemaVersion: 1,
    releaseId: source.releaseId,
    generatedAt: source.generatedAt,
    dataSource,
    source,
    edgeLineCatalog,
    availableDecades,
    citesEdge,
    unmappedPaletteRecords: buildUnmappedPaletteRecords(entities, mappedEntityIds),
  };
}

/**
 * One serialised payload per catalog instance. `listPublicEntityViews` hands back the same array
 * reference for the life of its in-process TTL (30 min), so keying on the array means a burst of
 * CDN misses across regions builds and stringifies the 6 MB once per instance per TTL, not once
 * per miss. A WeakMap so a retired catalog takes its payload with it.
 */
const payloadByCatalog = new WeakMap<readonly PublicEntityView[], Promise<string>>();

export async function buildAtlasCatalogJson(
  entities: readonly PublicEntityView[] = listPublicEntities(),
  dataSource: PublicReadSource = 'none',
): Promise<string> {
  const cached = payloadByCatalog.get(entities);
  if (cached) return cached;
  const pending = (async () => {
    const [artifact, citesEdge] = await Promise.all([
      resolveHistoryGraphReleaseArtifact(entities),
      resolveCitesEdgeIndex(),
    ]);
    return JSON.stringify(buildAtlasCatalogPayload(entities, artifact, citesEdge, dataSource));
  })();
  payloadByCatalog.set(entities, pending);
  pending.catch(() => payloadByCatalog.delete(entities));
  return pending;
}
