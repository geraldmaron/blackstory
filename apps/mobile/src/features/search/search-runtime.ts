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

async function buildRuntime(): Promise<SearchRuntime> {
  const [app, backend] = await Promise.all([getAppRuntime(), createExpoRecentSearchesBackend()]);
  const recentSearches = createRecentSearchesStore(backend);
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
