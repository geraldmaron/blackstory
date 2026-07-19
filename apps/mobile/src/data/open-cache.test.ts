import { openCache } from './open-cache';
import { createMemoryStore } from './db/memory-store';
import { META_KEYS } from './db/store';

describe('openCache degradation ladder (§3, ADR-022 rollback-considerations)', () => {
  it('opens SQLite and runs migrations on the happy path', async () => {
    const store = createMemoryStore();
    const result = await openCache({ openSqliteStore: async () => store });
    expect(result.mode).toBe('sqlite');
    expect(result.migration?.action).toBe('rebuilt'); // first launch
    expect(result.store).toBe(store);
  });

  it('deletes a corrupt DB file and retries once before succeeding', async () => {
    let attempts = 0;
    let deleted = false;
    const good = createMemoryStore();
    const result = await openCache({
      openSqliteStore: async () => {
        attempts++;
        if (attempts === 1) throw new Error('SQLITE_CORRUPT');
        return good;
      },
      deleteDatabaseFile: async () => {
        deleted = true;
      },
    });
    expect(deleted).toBe(true);
    expect(result.mode).toBe('sqlite');
    expect(result.store).toBe(good);
  });

  it('falls back to an in-memory store (no crash) when SQLite is unrecoverable', async () => {
    const result = await openCache({
      openSqliteStore: async () => {
        throw new Error('SQLITE_CANTOPEN');
      },
      deleteDatabaseFile: async () => {
        throw new Error('still broken');
      },
    });
    expect(result.mode).toBe('memory-fallback');
    expect(result.fallbackReason).toBe('Error');
    // The fallback store is usable and migrated.
    expect(await result.store.getMeta(META_KEYS.migrationState)).toBe('clean');
  });
});
