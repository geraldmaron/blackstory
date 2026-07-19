/**
 * Search feature's runtime composition (MOB-013).
 *
 * GAP THIS FILE FILLS: nothing in the app today wires MOB-009's data-layer primitives
 * (Transport, ReleaseCache, BootstrapSynchronizer, the SQLite runtime cache) into a real
 * composition root -- there is no `QueryClientProvider`/`PersistQueryClientProvider` and no
 * call to `createRuntimeCache()` anywhere under `src/app` or any other feature yet (verified by
 * repo search). Wiring an app-wide composition root belongs to whichever bead owns
 * `src/app/_layout.tsx`, which is out of this bead's exclusive paths
 * (`src/app/(tabs)/search.tsx` and `src/features/search/**` only). Rather than block on that or
 * duplicate TanStack Query wiring locally, this feature composes MOB-009's LOWER-LEVEL
 * primitives directly -- Transport + ReleaseCache + BootstrapSynchronizer + createSupersedingRunner
 * -- exactly the way `apps/mobile/src/data/bootstrap-sync.ts` itself is written (it doesn't use
 * TanStack Query either). This keeps search fully functional today and drop-in compatible with a
 * future root `QueryClientProvider`: swapping this hand-rolled fetch/cache glue for a `useQuery`
 * call would not need to change the underlying transport/cache contracts at all.
 *
 * SINGLETON DISCIPLINE: `createRuntimeCache()` "is the only runtime entry point that binds
 * expo-sqlite; call once at app start" (its own doc comment). Since nothing else in the app
 * currently calls it, this module memoizes a single promise so the search screen -- even if
 * mounted/unmounted repeatedly by tab navigation -- never opens the on-disk database twice. If a
 * second feature (e.g. MOB-012's map) later also needs a runtime instance, hoisting this to a
 * real app-start composition root becomes worth doing then; flagged as a follow-up, not fixed
 * here (out of this bead's file ownership).
 */
import {
  createRuntimeCache,
  createReleaseCache,
  createTransport,
  createSupersedingRunner,
  createBootstrapSynchronizer,
  hashSearchKey,
  type ReleaseCache,
  type Transport,
  type BootstrapSynchronizer,
} from '@/data';
import { createDefaultApiClient } from '@/security';
import { createRecentSearchesStore, createExpoRecentSearchesBackend, type RecentSearchesStore } from './recent-searches';

export interface SearchRuntime {
  readonly transport: Transport;
  readonly releaseCache: ReleaseCache;
  readonly bootstrapSync: BootstrapSynchronizer;
  readonly recentSearches: RecentSearchesStore;
  /** Cancels any in-flight search-related fetch before starting the next one (debounce-cancel and
   * pagination share this single slot -- see useSearch.ts). */
  readonly run: <T>(fn: (signal: AbortSignal) => Promise<T>) => Promise<T>;
  /** Per-install, non-secret-strength salt used only to make the on-disk search cache key
   * non-trivially reversible to the original text by a dictionary attack against the hash alone. */
  readonly searchSalt: string;
  hashQueryShape(shape: string): string;
}

let memoized: Promise<SearchRuntime> | null = null;

/** Best-effort per-install salt: not a cryptographic secret (nothing authorizes on it), just
 * enough entropy that the on-disk cache key (`hashSearchKey`) is not a bare, un-salted hash of
 * common search terms. Generated once and persisted via SecureStore's `createRecentSearchesStore`
 * backend port (same small-secret discipline, distinct key). */
const SEARCH_SALT_KEY = 'bs.search.salt_v1';

/** Generates 32 hex characters of non-cryptographic randomness. Good enough for a salt whose
 * only job is to keep the on-disk cache-key hash from being a bare, un-salted digest of common
 * search terms -- nothing is authorized on this value (contrast with a session token/secret). */
function randomHex32(): string {
  let out = '';
  for (let i = 0; i < 32; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

async function getOrCreateSearchSalt(backend: {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}): Promise<string> {
  const existing = await backend.getItemAsync(SEARCH_SALT_KEY);
  if (existing) return existing;
  const salt = randomHex32();
  await backend.setItemAsync(SEARCH_SALT_KEY, salt);
  return salt;
}

async function buildRuntime(): Promise<SearchRuntime> {
  const [{ store }, backend] = await Promise.all([
    createRuntimeCache(),
    createExpoRecentSearchesBackend(),
  ]);

  const releaseCache = createReleaseCache(store);
  const transport = createTransport({ apiClient: createDefaultApiClient() });
  const bootstrapSync = createBootstrapSynchronizer({ transport, cache: releaseCache, store });
  const recentSearches = createRecentSearchesStore(backend);
  const searchSalt = await getOrCreateSearchSalt(backend);
  const run = createSupersedingRunner();

  return {
    transport,
    releaseCache,
    bootstrapSync,
    recentSearches,
    run,
    searchSalt,
    hashQueryShape: (shape: string) => hashSearchKey(shape, searchSalt),
  };
}

/** Lazily builds (and memoizes) the real runtime. Never called from tests -- tests construct a
 * `SearchRuntime` directly from fakes and pass it into `useSearch`'s injection point. */
export function getSearchRuntime(): Promise<SearchRuntime> {
  if (!memoized) {
    memoized = buildRuntime().catch((err) => {
      memoized = null; // allow a retry on the next call instead of caching a permanent failure
      throw err;
    });
  }
  return memoized;
}
