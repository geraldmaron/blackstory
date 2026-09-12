/**
 * Search feature runtime (MOB-013 / repo-8b5h).
 *
 * Composes search-specific state (recent searches, salted query-hash) on top of
 * the shared app runtime from `@/runtime` so SQLite/bootstrap/transport are not
 * opened a second time.
 */
import { hashSearchKey } from '@/data';
import { getAppRuntime, type AppRuntime } from '@/runtime';
import {
  createRecentSearchesStore,
  createExpoRecentSearchesBackend,
  type RecentSearchesStore,
} from './recent-searches';

export interface SearchRuntime {
  readonly transport: AppRuntime['transport'];
  readonly releaseCache: AppRuntime['releaseCache'];
  readonly bootstrapSync: AppRuntime['bootstrapSync'];
  readonly recentSearches: RecentSearchesStore;
  readonly run: AppRuntime['run'];
  readonly searchSalt: string;
  hashQueryShape(shape: string): string;
}

let memoized: Promise<SearchRuntime> | null = null;

const SEARCH_SALT_KEY = 'bs.search.salt_v1';

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

/**
 * Marks that this app install has already run the recent-searches install-marker check.
 * Stored in the SQLite `cache_meta` table (the same store/table `query-client.ts`'s
 * persister uses), not SecureStore — the app's private data container is wiped on
 * uninstall on both platforms, unlike iOS Keychain (see repo-30k6). This flag also
 * disappears on an ADR-023 §5 drop-and-rebuild schema migration (an app update, not
 * a reinstall), which over-clears recent searches slightly more often than the
 * narrow "genuine reinstall" case requires -- an accepted, privacy-conservative
 * direction to err in for a small, low-stakes convenience list.
 */
export const RECENT_SEARCHES_INSTALL_MARKER_KEY = 'search.recent_searches_install_marker_v1';

/**
 * Clears any Keychain/Keystore-persisted recent-search terms left over from a prior
 * install, the first time this app sandbox sees them (repo-30k6, decisions-carryover.md
 * addendum 2026-09-12). A no-op on every launch after the first for a given install.
 */
export async function clearRecentSearchesOnFreshInstall(
  store: Pick<AppRuntime['store'], 'getMeta' | 'setMeta'>,
  recentSearches: Pick<RecentSearchesStore, 'clear'>,
): Promise<void> {
  const marker = await store.getMeta(RECENT_SEARCHES_INSTALL_MARKER_KEY);
  if (marker) return;
  await recentSearches.clear();
  await store.setMeta(RECENT_SEARCHES_INSTALL_MARKER_KEY, '1');
}

async function buildRuntime(): Promise<SearchRuntime> {
  const [app, backend] = await Promise.all([getAppRuntime(), createExpoRecentSearchesBackend()]);
  const recentSearches = createRecentSearchesStore(backend);
  await clearRecentSearchesOnFreshInstall(app.store, recentSearches);
  const searchSalt = await getOrCreateSearchSalt(backend);

  return {
    transport: app.transport,
    releaseCache: app.releaseCache,
    bootstrapSync: app.bootstrapSync,
    recentSearches,
    run: app.run,
    searchSalt,
    hashQueryShape: (shape: string) => hashSearchKey(shape, searchSalt),
  };
}

export function getSearchRuntime(): Promise<SearchRuntime> {
  if (!memoized) {
    memoized = buildRuntime().catch((err) => {
      memoized = null;
      throw err;
    });
  }
  return memoized;
}
