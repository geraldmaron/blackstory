import {
  shouldPersistQuery,
  createSqlitePersister,
  createMobileQueryClient,
  PERSISTED_CLIENT_META_KEY,
} from './query-client';
import { NeverCacheViolation } from './cache-policy';
import { createMemoryStore } from './db/memory-store';

describe('shouldPersistQuery (never-cache allow-list at the persist boundary)', () => {
  it('persists only allow-listed query roots', () => {
    expect(shouldPersistQuery({ queryKey: ['entity', 'e1'] })).toBe(true);
    expect(shouldPersistQuery({ queryKey: ['search-results', 'hash'] })).toBe(true);
    expect(shouldPersistQuery({ queryKey: ['map', 'v1'] })).toBe(true);
    // Anything else — including a hypothetical raw-query cache — is excluded.
    expect(shouldPersistQuery({ queryKey: ['search-raw', 'text'] })).toBe(false);
    expect(shouldPersistQuery({ queryKey: ['correction-draft'] })).toBe(false);
  });

  it('honours an explicit meta.persist === false opt-out', () => {
    expect(shouldPersistQuery({ queryKey: ['entity', 'e1'], meta: { persist: false } })).toBe(false);
  });
});

describe('SQLite persister', () => {
  const client = (clientState: unknown) => ({ timestamp: 1, buster: 'v1', clientState }) as any;

  it('round-trips a persisted client through the store', async () => {
    const store = createMemoryStore();
    const persister = createSqlitePersister(store);
    const snapshot = client({ mutations: [], queries: [{ queryKey: ['entity', 'e1'], state: {} }] });
    await persister.persistClient(snapshot);
    expect(await store.getMeta(PERSISTED_CLIENT_META_KEY)).toBeTruthy();
    const restored = await persister.restoreClient();
    expect(restored).toEqual(snapshot);
    await persister.removeClient();
    expect(await persister.restoreClient()).toBeUndefined();
  });

  it('tripwire: refuses to persist a snapshot carrying a never-cache field', async () => {
    const store = createMemoryStore();
    const persister = createSqlitePersister(store);
    const dirty = client({
      mutations: [],
      queries: [{ queryKey: ['entity', 'e1'], state: { data: { rawQuery: 'leaked text' } } }],
    });
    await expect(persister.persistClient(dirty)).rejects.toBeInstanceOf(NeverCacheViolation);
    expect(await store.getMeta(PERSISTED_CLIENT_META_KEY)).toBeUndefined(); // nothing written
  });

  it('restoreClient returns undefined on a corrupt snapshot', async () => {
    const store = createMemoryStore();
    await store.setMeta(PERSISTED_CLIENT_META_KEY, '{not json');
    const persister = createSqlitePersister(store);
    expect(await persister.restoreClient()).toBeUndefined();
  });
});

describe('createMobileQueryClient', () => {
  it('disables TanStack retry (transport owns retries) and sets a stale time', () => {
    const qc = createMobileQueryClient();
    const opts = qc.getDefaultOptions();
    expect(opts.queries?.retry).toBe(false);
    expect(opts.mutations?.retry).toBe(false);
    expect(opts.queries?.staleTime).toBeGreaterThan(0);
  });
});
