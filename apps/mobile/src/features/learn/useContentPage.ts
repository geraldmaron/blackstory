/**
 * React integration for the content repository (MOB-015 requirement #8).
 *
 * Wires `createContentRepository` to the REAL runtime cache/connectivity from `@/data`
 * (`createRuntimeCache`, `createNetInfoConnectivity`, `META_KEYS`) exactly the way a future
 * MOB-012+ screen would wire the typed API client — this hook is the integration point, not a
 * reimplementation. Native modules (`expo-sqlite`, NetInfo) are only reached lazily inside the
 * singleton initializer, so importing this module in a non-native test runner never loads them
 * (mirrors `@/data`'s own "lazy factories" discipline, see `src/data/index.ts`'s header comment).
 *
 * Device-level behavior (does the real SQLite cache actually persist across app restarts, does
 * NetInfo actually flip) is exercised by `@/data`'s own integration tests (deferred to MOB-019,
 * per `sqlite-store.ts`'s header) — this hook's pure logic (the repository itself) is unit-tested
 * in `content-repository.test.ts` against the same cache primitives with a memory store.
 */
import { useEffect, useState } from 'react';
import { createRuntimeCache, createReleaseCache, META_KEYS, type CacheStore, type Connectivity } from '@/data';
// `createNetInfoConnectivity` is not re-exported from the `@/data` barrel (only
// `createManualConnectivity` is, see `src/data/index.ts`) — imported from its module directly,
// same lazy-native-module discipline the barrel itself documents (this import is still lazy at
// the VALUE level: `createNetInfoConnectivity` itself only `import()`s NetInfo when called).
import { createNetInfoConnectivity } from '@/data/offline';
import { createContentRepository, UNBOOTSTRAPPED_STAMP, type ContentReadResult } from './content-repository';
import type { CatalogSectionId } from './content-catalog';

interface RuntimeHandles {
  readonly store: CacheStore;
  readonly connectivity: Connectivity;
}

let runtimeSingleton: Promise<RuntimeHandles> | null = null;

async function getRuntimeHandles(): Promise<RuntimeHandles> {
  if (!runtimeSingleton) {
    runtimeSingleton = (async () => {
      const { store } = await createRuntimeCache();
      const connectivity = await createNetInfoConnectivity();
      return { store, connectivity };
    })();
  }
  return runtimeSingleton;
}

export type UseContentPageState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | ContentReadResult;

/**
 * Loads a content page by (section, slug), preferring the network when online and falling back
 * to the offline cache when not — see `content-repository.ts` for the exact semantics. Re-fetches
 * whenever `section`/`slug` change.
 */
export function useContentPage(section: CatalogSectionId, slug: string): UseContentPageState {
  const [state, setState] = useState<UseContentPageState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    (async () => {
      try {
        const { store, connectivity } = await getRuntimeHandles();
        const cache = createReleaseCache(store);
        const repository = createContentRepository({
          cache,
          isOnline: () => connectivity.isOnline(),
          activeStamp: async () => (await store.getMeta(META_KEYS.releaseStamp)) ?? UNBOOTSTRAPPED_STAMP,
        });
        const result = await repository.getPage(section, slug);
        if (!cancelled) setState(result);
      } catch {
        // Never let a native-module init failure surface as a crash — an explicit error state
        // instead (ADR-022 §3 "no silent failures", extended to "no silent crashes" either).
        if (!cancelled) setState({ status: 'error' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [section, slug]);

  return state;
}
