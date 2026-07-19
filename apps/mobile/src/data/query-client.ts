/**
 * TanStack Query client + SQLite-backed persister (MOB-009 §2; ADR-022 §1/§2).
 *
 * TanStack Query is the in-memory HOT tier for server state (ADR-022 §1 — server
 * state lives here, NEVER duplicated into Zustand). This module adds the COLD
 * cross-launch tier by persisting the query cache THROUGH the same `CacheStore`
 * SQLite store the rest of the data layer uses.
 *
 * Why a CUSTOM persister rather than an off-the-shelf one: the maintained
 * persisters target AsyncStorage/localStorage, not our release-stamped,
 * size-capped SQLite store. A minimal custom persister that writes one meta row
 * keeps a single storage story (ADR-022 rejects fragmenting across AsyncStorage/
 * MMKV) and — crucially — lets us apply the NEVER-CACHE exclusion at dehydrate
 * time so no sensitive query key/data is ever persisted (§9).
 *
 * NEVER-CACHE at the persist boundary: `shouldPersistQuery` is the allow-list
 * gate. Only entity/search-results/map queries persist; a search query is keyed
 * by a HASH (cache-policy.hashSearchKey), never raw text, and any query can opt
 * out with `meta.persist === false`. `persistClient` additionally runs
 * `assertCacheSafe` over the serialized snapshot as a tripwire.
 */
import { QueryClient } from '@tanstack/react-query';
import type { Persister, PersistedClient } from '@tanstack/react-query-persist-client';
import { assertCacheSafe } from './cache-policy';
import type { CacheStore } from './db/store';

const PERSISTED_CLIENT_META_KEY = 'tanstack_persisted_client';

/** First-segment allow-list for query keys that may reach disk. */
const PERSISTABLE_KEY_ROOTS = new Set(['entity', 'search-results', 'map']);

/** Pure predicate — unit-tested. Excludes anything not on the allow-list, or
 * explicitly opted out via `meta.persist === false`. */
export function shouldPersistQuery(query: {
  queryKey: readonly unknown[];
  meta?: Record<string, unknown>;
}): boolean {
  if (query.meta?.persist === false) return false;
  const root = query.queryKey[0];
  return typeof root === 'string' && PERSISTABLE_KEY_ROOTS.has(root);
}

/**
 * A persister writing the dehydrated client to a single SQLite meta row. Bounded
 * by the query cache's own gc; the ~50 MB ceiling governs the entity/search/map
 * ENTRY tables (release-cache), which is where bulk lives — the persisted client
 * snapshot is the small hot-key index.
 */
export function createSqlitePersister(store: CacheStore): Persister {
  return {
    async persistClient(client: PersistedClient) {
      // Tripwire: refuse to write if a never-cache field slipped into a key/data.
      assertCacheSafe(client.clientState);
      await store.setMeta(PERSISTED_CLIENT_META_KEY, JSON.stringify(client));
    },
    async restoreClient() {
      const raw = await store.getMeta(PERSISTED_CLIENT_META_KEY);
      if (!raw) return undefined;
      try {
        return JSON.parse(raw) as PersistedClient;
      } catch {
        // Corrupt snapshot → treat as no cache; TanStack will removeClient.
        return undefined;
      }
    },
    async removeClient() {
      await store.setMeta(PERSISTED_CLIENT_META_KEY, '');
    },
  };
}

/**
 * Default client. `staleTime` is longer for immutable released entity data and
 * shorter for search (ADR-022 §2 staleness table). Retries are disabled here
 * because our typed transport (transport.ts) owns bounded backoff/jitter — we do
 * not want TanStack's retry stacked on top of the transport's.
 */
export function createMobileQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000, // entity/evidence: minutes (immutable release data)
        gcTime: 24 * 60 * 60_000,
        retry: false, // transport.ts owns retries
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false }, // mutations are NEVER retried (transport contract)
    },
  });
}

/**
 * Dehydrate options to pass to `PersistQueryClientProvider`'s `persistOptions`
 * so the never-cache allow-list is applied at the React wiring site:
 *
 *   persistOptions={{ persister, dehydrateOptions: mobileDehydrateOptions }}
 */
export const mobileDehydrateOptions = {
  shouldDehydrateQuery: shouldPersistQuery,
} as const;

export { PERSISTED_CLIENT_META_KEY };
