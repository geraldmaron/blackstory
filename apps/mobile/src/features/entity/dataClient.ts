/**
 * Entity fetch/cache wiring (MOB-014), built entirely on top of MOB-009's data layer
 * (`@/data`) and MOB-010's security layer (`@/security`) — this module adds NO new transport,
 * cache, or attestation logic of its own; it only composes what those layers already export
 * per the bead brief ("fetch entity data through this, respecting offline/cached-release
 * display requirements").
 *
 * INTEGRATION GAP — worth stating plainly, in the same spirit as `data/contracts.ts`'s own
 * "INTEGRATION GAP" callout. `apps/mobile` does not yet wire a `QueryClientProvider` or a
 * bootstrap-sync call at the app root (`src/app/_layout.tsx`, MOB-008's file, outside this
 * bead's exclusive ownership) — nothing calls `/v1/bootstrap` today. Rather than block this
 * bead on that wiring, `fetchEntityDetail` below treats EVERY successful `/v1/entity/:id`
 * response as authoritative for the global release stamp (via `releaseCache.applyReleaseStamp`,
 * the exact same primitive `bootstrap-sync.ts` uses) — valid because ADR-004 guarantees exactly
 * one active release at a time, so any endpoint's `revision.releaseId` names the same release
 * `/v1/bootstrap` would. A future bead that wires bootstrap-sync at app start makes this
 * redundant, not wrong: `applyReleaseStamp` is documented idempotent and safe to call from
 * multiple call sites.
 *
 * `EntityDataDeps` is fully dependency-injected (mirroring every other module in `data/`) so
 * `useEntityDetail.test.ts` can exercise offline/cache/error paths with fakes — no SQLite, no
 * network, no Firebase in the unit test run. `createRuntimeEntityDataDeps` is the ONE function
 * that binds the real native singletons, analogous to `data/index.ts`'s `createRuntimeCache`.
 */
import {
  createReleaseCache,
  createRuntimeCache,
  createTransport,
  TransportError,
  type CacheStore,
  type Connectivity,
  type ReleaseCache,
} from '@/data';
import { createDefaultApiClient } from '@/security';
import { normalizeEntity } from './normalize';
import type { Entity } from './types';

export interface EntityFreshness {
  readonly source: 'network' | 'cache';
  readonly fetchedAt: number;
  readonly degraded: boolean;
}

export type EntityFetchResult =
  | { readonly status: 'ready'; readonly entity: Entity; readonly freshness: EntityFreshness }
  | { readonly status: 'not-found' }
  | { readonly status: 'offline-no-cache' }
  | { readonly status: 'error'; readonly message: string };

export interface EntityDataDeps {
  readonly transport: { readJson<T>(path: string): Promise<{ kind: 'ok'; data: T } | { kind: 'not-modified' }> };
  readonly releaseCache: ReleaseCache;
  readonly store: Pick<CacheStore, 'delete'>;
  readonly connectivity: Connectivity;
  readonly now?: () => number;
}

const ENTITY_NAMESPACE = 'entity' as const;

function entityPath(id: string): string {
  return `/v1/entity/${encodeURIComponent(id)}`;
}

/**
 * Fetches one entity: network-first, falling back to the release-coupled cache on any
 * network/server failure (never on an authoritative 404 — see below), and reporting an honest
 * `degraded`/`offline` signal the UI must surface (ADR-022 §3, threat-model T7).
 */
export async function fetchEntityDetail(id: string, deps: EntityDataDeps): Promise<EntityFetchResult> {
  const now = deps.now ?? Date.now;
  const isOnline = deps.connectivity.isOnline();

  const readCache = async (degraded: boolean): Promise<EntityFetchResult | undefined> => {
    const activeStamp = (await deps.releaseCache.getActiveStamp()) ?? '';
    const cached = await deps.releaseCache.read<unknown>(ENTITY_NAMESPACE, id, {
      activeStamp,
      degraded,
      now: now(),
    });
    if (!cached) return undefined;
    const entity = normalizeEntity(cached.value);
    if (!entity) return undefined;
    return {
      status: 'ready',
      entity,
      freshness: { source: 'cache', fetchedAt: cached.freshness.fetchedAt, degraded },
    };
  };

  if (!isOnline) {
    const cachedResult = await readCache(true);
    return cachedResult ?? { status: 'offline-no-cache' };
  }

  try {
    const result = await deps.transport.readJson<unknown>(entityPath(id));
    if (result.kind !== 'ok') {
      // A 304 with no prior ETag sent is not a real path here (we never send If-None-Match for
      // entity reads today), but treat it the same as a cache-first read defensively.
      const cachedResult = await readCache(false);
      return cachedResult ?? { status: 'offline-no-cache' };
    }

    const entity = normalizeEntity(result.data);
    if (!entity) {
      return { status: 'error', message: 'This record could not be read.' };
    }

    // Treat this response's release as authoritative for the global stamp — see the module
    // header's INTEGRATION GAP note. Best-effort: a failure here must not fail the render.
    try {
      const stamp = entity.revision.releaseId || 'unknown-release';
      await deps.releaseCache.applyReleaseStamp(stamp, now());
      await deps.releaseCache.write(ENTITY_NAMESPACE, id, result.data, {
        releaseStamp: stamp,
        fetchedAt: now(),
      });
    } catch {
      // Caching is a convenience tier, never a requirement for a successful render.
    }

    return { status: 'ready', entity, freshness: { source: 'network', fetchedAt: now(), degraded: false } };
  } catch (err) {
    if (err instanceof TransportError && err.info.status === 404) {
      // Authoritative NOT_FOUND (identical for "withdrawn" and "never existed", threat-model
      // T3) — never keep serving a stale cached copy of content the server now says isn't
      // public. Best-effort eviction; a failure here must not hide the not-found state.
      try {
        await deps.store.delete(ENTITY_NAMESPACE, id);
      } catch {
        // ignore
      }
      return { status: 'not-found' };
    }

    // Any other failure (network unreachable, 5xx, parse error, size cap) degrades to cache,
    // never a bare crash/spinner (ADR-022 §3 "no silent failures").
    const cachedResult = await readCache(true);
    if (cachedResult) return cachedResult;
    return { status: 'error', message: 'Couldn’t load this record. Check your connection and try again.' };
  }
}

let runtimeDepsPromise: Promise<EntityDataDeps> | null = null;

/**
 * Binds the real native singletons (expo-sqlite via `createRuntimeCache`, NetInfo via the
 * lazy-imported connectivity module, App Check-attesting transport via `@/security`). Memoized
 * module-level so the SQLite database and transport are opened once per app session, not once
 * per screen mount. Not imported by any unit test (those inject fakes directly).
 */
export function createRuntimeEntityDataDeps(): Promise<EntityDataDeps> {
  if (!runtimeDepsPromise) {
    runtimeDepsPromise = (async () => {
      const { store } = await createRuntimeCache();
      const releaseCache = createReleaseCache(store);
      const apiClient = createDefaultApiClient();
      const transport = createTransport({ apiClient });
      const { createNetInfoConnectivity } = await import('@/data/offline');
      const connectivity = await createNetInfoConnectivity();
      return { transport, releaseCache, store, connectivity };
    })();
  }
  return runtimeDepsPromise;
}
