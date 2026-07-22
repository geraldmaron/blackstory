import {
  MAX_RECENT_ITEMS,
  MAX_RECENT_TERM_LENGTH,
  RECENT_SEARCHES_SECRET_KEY,
  addRecentSearch,
  createRecentSearchesStore,
  parseRecentSearches,
  removeRecentSearch,
  serializeRecentSearches,
  type RecentSearchEntry,
} from '../recent-searches';
import type { SecretBackend } from '@/data';

function fakeBackend(): SecretBackend & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async setItemAsync(key, value) {
      store.set(key, value);
    },
    async getItemAsync(key) {
      return store.get(key) ?? null;
    },
    async deleteItemAsync(key) {
      store.delete(key);
    },
  };
}

describe('addRecentSearch — pure reducer', () => {
  it('adds a new term to the front', () => {
    const result = addRecentSearch([], 'Harriet Tubman', 1000);
    expect(result).toEqual([{ term: 'Harriet Tubman', savedAt: 1000 }]);
  });

  it('de-duplicates case-insensitively, moving the existing term to the front with a fresh timestamp', () => {
    const existing: RecentSearchEntry[] = [
      { term: 'HARRIET TUBMAN', savedAt: 100 },
      { term: 'Frederick Douglass', savedAt: 50 },
    ];
    const result = addRecentSearch(existing, 'harriet tubman', 2000);
    expect(result).toEqual([
      { term: 'harriet tubman', savedAt: 2000 },
      { term: 'Frederick Douglass', savedAt: 50 },
    ]);
    // Only ONE entry for this term survives -- no case-variant duplicate.
    expect(result.filter((e) => e.term.toLowerCase() === 'harriet tubman')).toHaveLength(1);
  });

  it('caps the list at MAX_RECENT_ITEMS, dropping the oldest', () => {
    let list: RecentSearchEntry[] = [];
    for (let i = 0; i < MAX_RECENT_ITEMS + 3; i++) {
      list = addRecentSearch(list, `term-${i}`, i);
    }
    expect(list).toHaveLength(MAX_RECENT_ITEMS);
    // Most recent first; the earliest terms were evicted.
    expect(list[0].term).toBe(`term-${MAX_RECENT_ITEMS + 2}`);
    expect(list.some((e) => e.term === 'term-0')).toBe(false);
  });

  it('ignores an empty/whitespace-only term', () => {
    expect(addRecentSearch([], '   ', 1)).toEqual([]);
  });

  it('normalizes the term the same way live search input is normalized (huge input capped)', () => {
    const huge = 'x'.repeat(1000);
    const result = addRecentSearch([], huge, 1);
    expect(result[0].term.length).toBeLessThanOrEqual(MAX_RECENT_TERM_LENGTH);
  });
});

describe('removeRecentSearch — pure reducer', () => {
  it('removes a single matching entry, case-insensitively', () => {
    const list: RecentSearchEntry[] = [
      { term: 'Harriet Tubman', savedAt: 1 },
      { term: 'Frederick Douglass', savedAt: 2 },
    ];
    expect(removeRecentSearch(list, 'HARRIET TUBMAN')).toEqual([{ term: 'Frederick Douglass', savedAt: 2 }]);
  });

  it('is a no-op for a term not in the list', () => {
    const list: RecentSearchEntry[] = [{ term: 'Harriet Tubman', savedAt: 1 }];
    expect(removeRecentSearch(list, 'nobody')).toEqual(list);
  });
});

describe('parseRecentSearches — defensive parsing', () => {
  it('returns an empty list for undefined/corrupt/foreign JSON without throwing', () => {
    expect(parseRecentSearches(undefined)).toEqual([]);
    expect(() => parseRecentSearches('not json{{{')).not.toThrow();
    expect(parseRecentSearches('not json{{{')).toEqual([]);
    expect(parseRecentSearches('"just a string"')).toEqual([]);
    expect(parseRecentSearches('{"foo":"bar"}')).toEqual([]);
    expect(parseRecentSearches('[1,2,3]')).toEqual([]);
    expect(parseRecentSearches('[{"t":123,"s":"nope"}]')).toEqual([]);
  });

  it('round-trips through serializeRecentSearches', () => {
    const list: RecentSearchEntry[] = [
      { term: 'Harriet Tubman', savedAt: 1000 },
      { term: 'Frederick Douglass', savedAt: 900 },
    ];
    const serialized = serializeRecentSearches(list);
    expect(parseRecentSearches(serialized)).toEqual(list);
  });

  it('caps at MAX_RECENT_ITEMS even if the stored payload somehow carries more', () => {
    const oversized = Array.from({ length: MAX_RECENT_ITEMS + 10 }, (_, i) => ({ t: `term-${i}`, s: i }));
    const serialized = JSON.stringify(oversized);
    expect(parseRecentSearches(serialized)).toHaveLength(MAX_RECENT_ITEMS);
  });
});

describe('createRecentSearchesStore — SecureStore-backed integration (fake backend)', () => {
  it('add/list/remove/clear round-trip through the injected backend', async () => {
    const backend = fakeBackend();
    const store = createRecentSearchesStore(backend);

    expect(await store.list()).toEqual([]);

    await store.add('Harriet Tubman', 1000);
    await store.add('Frederick Douglass', 2000);
    const list = await store.list();
    expect(list.map((e) => e.term)).toEqual(['Frederick Douglass', 'Harriet Tubman']);

    const afterRemove = await store.remove('Harriet Tubman');
    expect(afterRemove.map((e) => e.term)).toEqual(['Frederick Douglass']);

    await store.clear();
    expect(await store.list()).toEqual([]);
    expect(backend.store.has(RECENT_SEARCHES_SECRET_KEY)).toBe(false);
  });

  it('stores data ONLY under the dedicated recent-searches key -- never the raw search-salt or any other secret key', async () => {
    const backend = fakeBackend();
    const store = createRecentSearchesStore(backend);
    await store.add('a term', 1);
    expect([...backend.store.keys()]).toEqual([RECENT_SEARCHES_SECRET_KEY]);
  });

  it('the serialized payload stays comfortably under the small-secret byte budget at full capacity', async () => {
    const backend = fakeBackend();
    const store = createRecentSearchesStore(backend);
    for (let i = 0; i < MAX_RECENT_ITEMS; i++) {
      await store.add(`a reasonably descriptive search term number ${i}`, i);
    }
    const raw = backend.store.get(RECENT_SEARCHES_SECRET_KEY) ?? '';
    // MAX_SECRET_BYTES in apps/mobile/src/data/secure-store.ts is 512 -- this asserts our actual
    // usage pattern stays under that without needing to import the constant (kept independent of
    // the internals of a file this bead does not own).
    expect(Buffer.byteLength(raw, 'utf8')).toBeLessThan(512);
  });
});
