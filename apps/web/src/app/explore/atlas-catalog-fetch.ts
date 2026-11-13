/**
 * The one fetch of `GET /atlas/catalog`, shared by whoever asks first.
 *
 * The list waits on this payload, so it starts as early as the page knows it will need it: on a
 * cold `/explore` when the Door mounts in browse posture, on `/` the moment browse is entered,
 * and otherwise when `AtlasLoader` mounts. Starting it from `AtlasLoader` alone put the request
 * behind hydration and the Atlas chunk's download.
 *
 * The last catalog is also kept in module memory: navigating away and back within one session
 * re-mounts the loader, and a re-parse for bytes already in hand is not a cost worth paying.
 * Keyed by URL so a future versioned path cannot serve a stale shape.
 */
import { decodeCollectionCatalog } from '../../lib/discovery/collection-catalog-wire';
import { hasMaintenanceBypassHint } from '../../lib/maintenance/maintenance-bypass-hint';
import { ATLAS_CATALOG_PATH, type AtlasCatalogPayload } from './explore-view-model-wire';

let lastCatalog: { readonly url: string; readonly payload: AtlasCatalogPayload } | undefined;
let inFlight: { readonly url: string; readonly promise: Promise<AtlasCatalogPayload> } | undefined;

/** The catalog already in hand for this URL, if any. */
export function cachedAtlasCatalog(url = ATLAS_CATALOG_PATH): AtlasCatalogPayload | undefined {
  return lastCatalog?.url === url ? lastCatalog.payload : undefined;
}

/** Starts (or joins) the catalog fetch. A failed fetch is forgotten so a retry fetches again. */
export function fetchAtlasCatalog(url = ATLAS_CATALOG_PATH): Promise<AtlasCatalogPayload> {
  const cached = cachedAtlasCatalog(url);
  if (cached) return Promise.resolve(cached);
  if (inFlight?.url === url) return inFlight.promise;
  // `omit` is the normal path: the catalog is public, CDN-cached, and has no business seeing a
  // cookie. The one exception is an operator holding a maintenance bypass, whose credential has
  // to ride along or the wall answers this fetch with a 503 and Explore comes up empty behind
  // its own bypass. The hint cookie only exists while the wall is up.
  const credentials = hasMaintenanceBypassHint() ? 'same-origin' : 'omit';
  const promise = fetch(url, { credentials })
    .then(async (response) => {
      if (!response.ok) throw new Error(`atlas catalog ${response.status}`);
      const payload = decodeCollectionCatalog(await response.json());
      lastCatalog = { url, payload };
      return payload;
    })
    .finally(() => {
      if (inFlight?.promise === promise) inFlight = undefined;
    });
  inFlight = { url, promise };
  return promise;
}
