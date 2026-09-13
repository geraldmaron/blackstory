import { clearRecentSearchesOnFreshInstall } from '../search-runtime';

function fakeStore(initialMeta: Record<string, string> = {}) {
  const meta = new Map<string, string>(Object.entries(initialMeta));
  return {
    meta,
    async getMeta(key: string) {
      return meta.get(key);
    },
    async setMeta(key: string, value: string) {
      meta.set(key, value);
    },
  };
}

function fakeRecentSearches() {
  let clearCalls = 0;
  return {
    get clearCalls() {
      return clearCalls;
    },
    async clear() {
      clearCalls += 1;
    },
  };
}

describe('clearRecentSearchesOnFreshInstall (repo-30k6)', () => {
  it('clears recent searches and sets the marker on a fresh install (no marker present)', async () => {
    const store = fakeStore();
    const recentSearches = fakeRecentSearches();

    await clearRecentSearchesOnFreshInstall(store, recentSearches);

    expect(recentSearches.clearCalls).toBe(1);
    expect(store.meta.get('search.recent_searches_install_marker_v1')).toBe('1');
  });

  it('is a no-op on a normal launch (marker already present)', async () => {
    const store = fakeStore({ 'search.recent_searches_install_marker_v1': '1' });
    const recentSearches = fakeRecentSearches();

    await clearRecentSearchesOnFreshInstall(store, recentSearches);

    expect(recentSearches.clearCalls).toBe(0);
  });

  it('clears again after the marker disappears (simulating an uninstall/reinstall or schema drop-and-rebuild)', async () => {
    const store = fakeStore({ 'search.recent_searches_install_marker_v1': '1' });
    const recentSearches = fakeRecentSearches();

    // First call: marker present, no-op.
    await clearRecentSearchesOnFreshInstall(store, recentSearches);
    expect(recentSearches.clearCalls).toBe(0);

    // Simulate the marker being wiped (uninstall, or an ADR-023 §5 drop-and-rebuild migration;
    // ADR-023 is restated in `docs/decisions-carryover.md`, "Mobile cache and OTA release") —
    // the SecureStore-backed recent-searches key would survive this on iOS even though the
    // sandbox-backed marker did not.
    store.meta.delete('search.recent_searches_install_marker_v1');

    await clearRecentSearchesOnFreshInstall(store, recentSearches);
    expect(recentSearches.clearCalls).toBe(1);
    expect(store.meta.get('search.recent_searches_install_marker_v1')).toBe('1');
  });

  it('only clears once across repeated calls once the marker is set', async () => {
    const store = fakeStore();
    const recentSearches = fakeRecentSearches();

    await clearRecentSearchesOnFreshInstall(store, recentSearches);
    await clearRecentSearchesOnFreshInstall(store, recentSearches);
    await clearRecentSearchesOnFreshInstall(store, recentSearches);

    expect(recentSearches.clearCalls).toBe(1);
  });
});
