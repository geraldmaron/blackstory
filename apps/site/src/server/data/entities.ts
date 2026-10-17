/**
 * Release-scoped entity reads on the site cache. Port of the entity half of
 * apps/web/src/lib/public-data/source.ts (`loadLiveEntities`, `loadLiveEntity`,
 * `loadLiveEntitiesByIdsThin`, `resolvePublicEntityRedirect`, `listPublicEntityViewsByIds`). The read
 * model itself (citation retention, learning-link hydration, the 1-3 hop walk) is the shared
 * `entity-views.ts`; this module is only "which read, through which cache".
 *
 * Differences from the Next path, each on purpose:
 *   - one entity page was an uncached point-read set (up to a dozen queries) per request, with the
 *     CDN as the only cache. Here every read goes through the process cache, so a crawler pass over
 *     entity URLs costs the database once per entity per soft TTL, not once per request.
 *   - misses are cached too (entities and redirects). A 404 storm of made-up ids would otherwise be a
 *     query per request; the caches are LRU-bounded so junk ids cannot grow memory.
 *   - an id longer than MAX_ENTITY_ID_LENGTH is a miss without touching the database.
 */
import { createHash } from 'node:crypto';
import { createCatalogCache, type CatalogCache, type ReleaseKey } from './cache';
import { CatalogUnavailableError } from './catalog';

export const MAX_ENTITY_ID_LENGTH = 200;

export type EntityDeps<View, Projection> = {
  readonly preferArtifacts: () => boolean;
  readonly fetchEntitiesArtifact: (
    releaseId: string,
  ) => Promise<{ entities: readonly unknown[] } | undefined>;
  readonly listProjections: (releaseId: string) => Promise<readonly Projection[]>;
  readonly projectionsFromArtifact: (entities: readonly unknown[]) => Projection[];
  readonly hydrateAll: (projections: readonly Projection[]) => readonly View[];
  readonly loadNeighborhood: (releaseId: string, entityId: string) => Promise<View | undefined>;
  readonly loadThin: (releaseId: string, entityIds: readonly string[]) => Promise<readonly View[]>;
  readonly fetchRedirect: (releaseId: string, entityId: string) => Promise<string | undefined>;
  readonly idOf: (view: View) => string;
  readonly warn: (message: string) => void;
};

export type EntityCatalog<View> = {
  /** The full hydrated release catalog (optionally pinned to a release). Throws CatalogUnavailableError when there is none. */
  getEntities(
    release?: ReleaseKey,
  ): Promise<{ readonly data: readonly View[]; readonly release: ReleaseKey }>;
  /** One entity with its neighborhood; undefined for a miss or when public data is not live. */
  getEntity(entityId: string): Promise<View | undefined>;
  /** Thin card/list views in request order (deduplicated); ids with no record are omitted. */
  getEntitiesByIds(entityIds: readonly string[]): Promise<readonly View[]>;
  /** Where a retired entity id now lives, if anywhere. Lookup failures answer undefined. */
  getEntityRedirect(entityId: string): Promise<string | undefined>;
  readonly caches: readonly CatalogCache<never>[];
};

type Maybe<V> = { readonly value: V | null };

export function createEntityCatalog<View, Projection>(
  deps: EntityDeps<View, Projection>,
  getRelease: () => Promise<ReleaseKey | undefined>,
  options: { readonly now?: () => number } = {},
): EntityCatalog<View> {
  const clock = options.now === undefined ? {} : { now: options.now };
  const catalogCache = createCatalogCache<readonly View[]>({
    kind: 'public-release-entities',
    ...clock,
  });
  const entityCache = createCatalogCache<Maybe<View>>({
    kind: 'public-release-entity',
    ...clock,
    maxEntries: 500,
    lastGoodMaxKeys: 100,
    staleEligible: (found) => found.value !== null,
  });
  const byIdsCache = createCatalogCache<readonly View[]>({
    kind: 'public-release-entities-by-ids',
    ...clock,
    maxEntries: 200,
    lastGoodMaxKeys: 50,
  });
  // A redirect either exists or it does not; there is nothing to refresh, so soft TTL equals hard TTL.
  const redirectCache = createCatalogCache<Maybe<string>>({
    kind: 'public-release-entity-redirect',
    ...clock,
    ttlMs: 10 * 60_000,
    softTtlMs: 10 * 60_000,
    maxEntries: 500,
    lastGoodMaxKeys: 0,
    staleEligible: () => false,
  });

  async function loadCatalog(releaseId: string): Promise<readonly View[] | undefined> {
    if (deps.preferArtifacts()) {
      const artifact = await deps.fetchEntitiesArtifact(releaseId);
      if (artifact && artifact.entities.length > 0) {
        const projections = deps.projectionsFromArtifact(artifact.entities);
        if (projections.length > 0) return deps.hydrateAll(projections);
        deps.warn(
          `[site-data] entities artifact had ${artifact.entities.length} entries but none parsed; falling back to Postgres`,
        );
      }
      deps.warn(
        `[site-data] full Postgres entity catalog pull for ${releaseId} (artifact unusable)`,
      );
    }
    const projections = await deps.listProjections(releaseId);
    if (projections.length === 0) return undefined;
    return deps.hydrateAll(projections);
  }

  const usableId = (entityId: string): boolean =>
    entityId.length > 0 && entityId.length <= MAX_ENTITY_ID_LENGTH;

  return {
    caches: [
      catalogCache,
      entityCache,
      byIdsCache,
      redirectCache,
    ] as unknown as readonly CatalogCache<never>[],

    async getEntities(pinned) {
      // A caller that already read another catalog for this request passes its release, so one page is
      // never built from two releases.
      const release = pinned ?? (await getRelease());
      if (!release)
        throw new CatalogUnavailableError('public data is not configured to read the live catalog');
      const data = await catalogCache.get(release, () => loadCatalog(release.releaseId));
      if (!data || data.length === 0)
        throw new CatalogUnavailableError(`entity catalog unavailable for ${release.releaseId}`);
      return { data, release };
    },

    async getEntity(entityId) {
      const id = entityId.trim();
      if (!usableId(id)) return undefined;
      const release = await getRelease();
      if (!release) return undefined;
      const found = await entityCache.get(
        release,
        async () => ({ value: (await deps.loadNeighborhood(release.releaseId, id)) ?? null }),
        id,
      );
      return found?.value ?? undefined;
    },

    async getEntitiesByIds(entityIds) {
      const requestOrder = [
        ...new Set(entityIds.map((id) => id.trim()).filter((id) => id.length > 0)),
      ];
      if (requestOrder.length === 0) return [];
      if (requestOrder.some((id) => !usableId(id))) {
        deps.warn('[site-data] getEntitiesByIds ignored an over-long id');
      }
      const ids = requestOrder.filter(usableId);
      if (ids.length === 0) return [];
      const release = await getRelease();
      if (!release) return [];
      const scope = createHash('sha1')
        .update(JSON.stringify([...ids].sort()))
        .digest('hex');
      const loaded = await byIdsCache.get(
        release,
        () => deps.loadThin(release.releaseId, ids),
        scope,
      );
      const byId = new Map((loaded ?? []).map((view) => [deps.idOf(view), view] as const));
      return ids.flatMap((id) => {
        const hit = byId.get(id);
        return hit === undefined ? [] : [hit];
      });
    },

    async getEntityRedirect(entityId) {
      const id = entityId.trim();
      if (!usableId(id)) return undefined;
      try {
        const release = await getRelease();
        if (!release) return undefined;
        const found = await redirectCache.get(
          release,
          async () => ({ value: (await deps.fetchRedirect(release.releaseId, id)) ?? null }),
          id,
        );
        return found?.value ?? undefined;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        deps.warn(`[site-data] redirect lookup failed for ${id}: ${message}`);
        return undefined;
      }
    },
  };
}
