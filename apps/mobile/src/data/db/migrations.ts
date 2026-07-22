/**
 * Cache migration orchestration (MOB-009 §3 / ADR-022 §5).
 *
 * ADR-022 §5 mandates DESTRUCTIVE drop-and-rebuild migrations: the cache is not
 * a system of record, so any schema change wipes it and it repopulates lazily
 * from the network. The hard requirement (threat-model adjacent, bead §3) is
 * that a migration interrupted MID-FLIGHT (app killed, I/O error) must, on the
 * NEXT launch, detect the incomplete/corrupt state and safely rebuild — never
 * serve a half-migrated cache as if valid.
 *
 * Mechanism (write-ahead intent flag):
 *   1. Read on-disk `schema_version` and `migration_state`.
 *   2. A rebuild is required when ANY of:
 *        - `migration_state == 'in_progress'`  (a prior migration was interrupted)
 *        - on-disk schema_version != expected  (schema changed across app update)
 *        - schema_version is absent             (first launch / wiped DB)
 *        - `isHealthy()` is false               (corrupt store)
 *   3. To rebuild we FIRST set `migration_state = 'in_progress'` and persist it,
 *      THEN drop + ensureSchema, THEN write the new `schema_version` and set
 *      `migration_state = 'clean'` LAST. Because the clean flag is written last,
 *      a crash anywhere in the middle leaves `in_progress` on disk and the next
 *      launch re-runs the rebuild from scratch. The operation is idempotent:
 *      re-dropping an already-dropped cache is harmless.
 *
 * All of this is orchestration over the `CacheStore` port, so it is unit-tested
 * with an in-memory store that can fault at any step (migrations.test.ts).
 */
import { CACHE_SCHEMA_VERSION } from './schema';
import { META_KEYS, type CacheStore, type MigrationState } from './store';

export type MigrationOutcome =
  | { readonly action: 'up-to-date'; readonly schemaVersion: number }
  | {
      readonly action: 'rebuilt';
      readonly schemaVersion: number;
      readonly reason: 'interrupted' | 'version-mismatch' | 'absent' | 'corrupt';
    };

async function readSchemaVersion(store: CacheStore): Promise<number | undefined> {
  const raw = await store.getMeta(META_KEYS.schemaVersion);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) ? n : undefined;
}

async function readMigrationState(store: CacheStore): Promise<MigrationState> {
  const raw = await store.getMeta(META_KEYS.migrationState);
  return raw === 'in_progress' ? 'in_progress' : 'clean';
}

/**
 * Runs migrations to `expectedVersion`. Returns what it did. Safe to call on
 * every launch. NEVER throws for a corrupt/half-migrated store — that is exactly
 * the case it exists to repair; it throws only if the underlying store is so
 * broken that even a rebuild fails, which the caller handles by falling back to
 * the memory store.
 */
export async function runMigrations(
  store: CacheStore,
  expectedVersion: number = CACHE_SCHEMA_VERSION,
): Promise<MigrationOutcome> {
  // Ensure the schema/meta exist before we can read the meta flags at all.
  await store.ensureSchema();

  const state = await readMigrationState(store);
  const onDisk = await readSchemaVersion(store);
  const healthy = await store.isHealthy();

  let reason: 'interrupted' | 'version-mismatch' | 'absent' | 'corrupt';
  if (state === 'in_progress') {
    reason = 'interrupted';
  } else if (!healthy) {
    reason = 'corrupt';
  } else if (onDisk === undefined) {
    reason = 'absent';
  } else if (onDisk !== expectedVersion) {
    reason = 'version-mismatch';
  } else {
    return { action: 'up-to-date', schemaVersion: onDisk };
  }

  await rebuild(store, expectedVersion);
  return { action: 'rebuilt', schemaVersion: expectedVersion, reason };
}

/**
 * The destructive rebuild. Order matters for crash-safety: the intent flag is
 * written BEFORE the drop and the "clean + new version" markers are written
 * LAST, so an interruption at any point re-triggers a rebuild next launch
 * rather than leaving a half-migrated cache marked valid.
 */
async function rebuild(store: CacheStore, version: number): Promise<void> {
  // 1. Persist intent FIRST. If we crash after this, next launch sees
  //    `in_progress` and rebuilds again.
  await store.setMeta(META_KEYS.migrationState, 'in_progress');
  // 2. Destroy and recreate. Idempotent — safe to repeat after a crash.
  await store.dropAll();
  await store.ensureSchema();
  // 3. Re-persist intent (dropAll may have cleared meta) and stamp the version.
  await store.setMeta(META_KEYS.migrationState, 'in_progress');
  await store.setMeta(META_KEYS.schemaVersion, String(version));
  // 4. Mark clean LAST — the only point at which the cache is considered valid.
  await store.setMeta(META_KEYS.migrationState, 'clean');
}
