/**
 * Shared test doubles for the search feature's test suite. Deliberately lives OUTSIDE
 * `__tests__/` (a sibling of the other feature source files): jest-expo's default `testMatch`
 * treats every file under `__tests__/` as its own test suite regardless of filename, so a helper
 * module with no `describe`/`it` living there would be picked up and fail as an empty suite.
 * Not exported from `index.ts` -- this is test-only, never part of the feature's public surface.
 */
import { TransportError, createSupersedingRunner, type ReleaseCache, type Transport } from '@/data';
import { createRecentSearchesStore } from './recent-searches';
import type { SearchRuntime } from './search-runtime';
import type { SearchResponseV1 } from './search-contracts';

export function emptyFacets() {
  return { kind: {}, status: {}, era: {}, theme: {}, state: {}, recordMaturity: {}, researchCoverage: {} };
}

export function page(overrides: Partial<SearchResponseV1> = {}): SearchResponseV1 {
  return {
    results: [
      {
        id: 'ent_1',
        kind: 'person',
        displayName: 'Harriet Tubman',
        matchedOn: 'displayName',
        matchedText: 'Harriet Tubman',
        explanation: 'Matched on name.',
        eraBuckets: [],
        notabilityLabels: [],
      },
    ],
    facets: emptyFacets(),
    totalMatched: 1,
    hasMore: false,
    ...overrides,
  };
}

export function fakeReleaseCache(initialStamp: string | undefined): ReleaseCache & { setStamp(s: string | undefined): void } {
  let stamp = initialStamp;
  const rows = new Map<string, { value: unknown; releaseStamp: string; fetchedAt: number }>();
  return {
    async getActiveStamp() {
      return stamp;
    },
    async applyReleaseStamp(serverStamp: string) {
      stamp = serverStamp;
      return 0;
    },
    async write(namespace, key, value, meta) {
      rows.set(`${namespace}:${key}`, { value, releaseStamp: meta.releaseStamp, fetchedAt: meta.fetchedAt });
    },
    async verifyAndWriteArtifact() {
      throw new Error('not used in these tests');
    },
    async read<T>(namespace: string, key: string, opts: { activeStamp: string; degraded: boolean; now: number }) {
      const row = rows.get(`${namespace}:${key}`);
      if (!row) return undefined;
      if (row.releaseStamp !== opts.activeStamp) {
        rows.delete(`${namespace}:${key}`);
        return undefined;
      }
      return {
        value: row.value as T,
        freshness: { source: 'cache' as const, fetchedAt: row.fetchedAt, releaseStamp: row.releaseStamp, degraded: opts.degraded },
      };
    },
    setStamp(next) {
      stamp = next;
    },
  };
}

interface PendingCall {
  readonly path: string;
  resolve(value: unknown): void;
  reject(err: unknown): void;
}

export function makeControllableTransport(opts: { cooperative: boolean }): {
  transport: Transport;
  calls: string[];
  resolveNext(value: unknown): void;
  rejectNext(err: unknown): void;
  resolveCallAt(index: number, value: unknown): void;
  rejectCallAt(index: number, err: unknown): void;
  pendingCount(): number;
} {
  const calls: string[] = [];
  const byIndex: PendingCall[] = [];
  const pendingSet = new Set<PendingCall>();

  const transport: Transport = {
    readJson: <T,>(path: string, readOpts?: { signal?: AbortSignal }) => {
      calls.push(path);
      return new Promise<{ kind: 'ok'; status: number; data: T; etag?: string }>((resolve, reject) => {
        const entry: PendingCall = { path, resolve: resolve as (v: unknown) => void, reject };
        byIndex.push(entry);
        pendingSet.add(entry);
        if (opts.cooperative && readOpts?.signal) {
          readOpts.signal.addEventListener('abort', () => {
            pendingSet.delete(entry);
            reject(new TransportError('aborted', { kind: 'aborted', attempts: 1 }));
          });
        }
      });
    },
    mutate: async () => {
      throw new Error('mutate is not used by search');
    },
  };

  function oldestPending(): PendingCall {
    const entry = byIndex.find((e) => pendingSet.has(e));
    if (!entry) throw new Error('no pending call');
    return entry;
  }

  return {
    transport,
    calls,
    resolveNext(value: unknown) {
      const entry = oldestPending();
      pendingSet.delete(entry);
      entry.resolve({ kind: 'ok', status: 200, data: value });
    },
    rejectNext(err: unknown) {
      const entry = oldestPending();
      pendingSet.delete(entry);
      entry.reject(err);
    },
    resolveCallAt(index: number, value: unknown) {
      const entry = byIndex[index];
      if (!entry || !pendingSet.has(entry)) throw new Error(`call ${index} is not pending`);
      pendingSet.delete(entry);
      entry.resolve({ kind: 'ok', status: 200, data: value });
    },
    rejectCallAt(index: number, err: unknown) {
      const entry = byIndex[index];
      if (!entry || !pendingSet.has(entry)) throw new Error(`call ${index} is not pending`);
      pendingSet.delete(entry);
      entry.reject(err);
    },
    pendingCount: () => pendingSet.size,
  };
}

export function buildRuntime(
  transport: Transport,
  releaseCache: ReleaseCache,
): { runtime: SearchRuntime; recentAdds: string[] } {
  const backendStore = new Map<string, string>();
  const backend = {
    async setItemAsync(key: string, value: string) {
      backendStore.set(key, value);
    },
    async getItemAsync(key: string) {
      return backendStore.get(key) ?? null;
    },
    async deleteItemAsync(key: string) {
      backendStore.delete(key);
    },
  };
  const recentAdds: string[] = [];
  const realRecentSearches = createRecentSearchesStore(backend);
  const recentSearches = {
    ...realRecentSearches,
    async add(term: string, now?: number) {
      recentAdds.push(term);
      return realRecentSearches.add(term, now);
    },
  };

  const runtime: SearchRuntime = {
    transport,
    releaseCache,
    bootstrapSync: { sync: async () => ({ status: 'unchanged', stamp: 'r1' }) },
    recentSearches,
    run: createSupersedingRunner(),
    searchSalt: 'test-salt',
    hashQueryShape: (shape: string) => shape,
  };

  return { runtime, recentAdds };
}

export async function flushMicrotasks(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}
