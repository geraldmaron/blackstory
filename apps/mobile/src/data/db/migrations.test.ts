import { runMigrations } from './migrations';
import { createMemoryStore } from './memory-store';
import { META_KEYS } from './store';
import { CACHE_SCHEMA_VERSION } from '../db/schema';

async function seedEntry(store: ReturnType<typeof createMemoryStore>, key = 'e1') {
  await store.put({
    namespace: 'entity',
    key,
    value: '{"id":"e1"}',
    releaseStamp: 'r1',
    fetchedAt: 1,
    lastAccessedAt: 1,
    byteLength: 11,
  });
}

describe('runMigrations — drop-and-rebuild (ADR-022 §5)', () => {
  it('rebuilds on a first launch (absent schema version) and marks clean', async () => {
    const store = createMemoryStore();
    const outcome = await runMigrations(store, CACHE_SCHEMA_VERSION);
    expect(outcome).toMatchObject({ action: 'rebuilt', reason: 'absent' });
    expect(await store.getMeta(META_KEYS.schemaVersion)).toBe(String(CACHE_SCHEMA_VERSION));
    expect(await store.getMeta(META_KEYS.migrationState)).toBe('clean');
  });

  it('is a no-op when the on-disk version already matches', async () => {
    const store = createMemoryStore();
    await runMigrations(store, CACHE_SCHEMA_VERSION);
    await seedEntry(store);
    const outcome = await runMigrations(store, CACHE_SCHEMA_VERSION);
    expect(outcome.action).toBe('up-to-date');
    // Data preserved when nothing changed.
    expect(await store.get('entity', 'e1')).toBeDefined();
  });

  it('rebuilds (wiping data) on a schema version bump', async () => {
    const store = createMemoryStore();
    await runMigrations(store, 1);
    await seedEntry(store);
    const outcome = await runMigrations(store, 2);
    expect(outcome).toMatchObject({ action: 'rebuilt', reason: 'version-mismatch' });
    expect(await store.get('entity', 'e1')).toBeUndefined(); // dropped
    expect(await store.getMeta(META_KEYS.schemaVersion)).toBe('2');
  });

  it('detects a corrupt store and rebuilds instead of crashing', async () => {
    const store = createMemoryStore({ corrupt: true });
    const outcome = await runMigrations(store, CACHE_SCHEMA_VERSION);
    expect(outcome).toMatchObject({ action: 'rebuilt', reason: 'corrupt' });
    expect(await store.getMeta(META_KEYS.migrationState)).toBe('clean');
  });

  it('SAFETY: app killed mid-migration leaves in_progress → next launch rebuilds cleanly', async () => {
    // Launch 1: force a crash AFTER the intent flag is written but during the
    // destructive drop (simulating a process kill mid-migration).
    const store = createMemoryStore({ failOnce: 'dropAll' });
    await seedEntry(store); // stale half-migrated data present
    await expect(runMigrations(store, 2)).rejects.toThrow(/simulated fault/);
    // The intent flag persisted before the crash proves the interruption.
    expect(await store.getMeta(META_KEYS.migrationState)).toBe('in_progress');

    // Launch 2: same store, no fault. Must DETECT the interrupted state and
    // rebuild from scratch rather than serving the half-migrated cache.
    const outcome = await runMigrations(store, 2);
    expect(outcome).toMatchObject({ action: 'rebuilt', reason: 'interrupted' });
    expect(await store.get('entity', 'e1')).toBeUndefined(); // stale data gone
    expect(await store.getMeta(META_KEYS.migrationState)).toBe('clean');
    expect(await store.getMeta(META_KEYS.schemaVersion)).toBe('2');
  });
});
