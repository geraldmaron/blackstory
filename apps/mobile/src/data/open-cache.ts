/**
 * Cache bootstrap wiring (MOB-009 §3; ADR-022 §5 + rollback-considerations).
 *
 * Opens the on-disk cache, runs migrations, and — critically — NEVER crashes the
 * app if the store is unavailable or corrupt beyond a single rebuild. The
 * degradation ladder:
 *
 *   1. Open expo-sqlite + run migrations. If migrations detect an incomplete or
 *      corrupt state they drop-and-rebuild (migrations.ts). Normal path.
 *   2. If opening/migrating THROWS (unrecoverable file corruption, locked DB),
 *      delete the on-disk file and retry once from scratch.
 *   3. If it still fails, fall back to an IN-MEMORY store: the app runs
 *      online-only with no cross-launch offline read (ADR-022
 *      rollback-considerations: "Disabling the persistent cache degrades to
 *      online-only fetching"). This is honest degradation, not a crash.
 *
 * The native imports live behind factory callbacks so this module — and the
 * tests that exercise the degradation ladder — never load a native module
 * directly.
 */
import { runMigrations, type MigrationOutcome } from './db/migrations';
import { createMemoryStore } from './db/memory-store';
import type { CacheStore } from './db/store';

export type CacheMode = 'sqlite' | 'memory-fallback';

export interface OpenCacheResult {
  readonly store: CacheStore;
  readonly mode: CacheMode;
  readonly migration?: MigrationOutcome;
  /** Set when we fell back to memory; carries the reason for observability. */
  readonly fallbackReason?: string;
}

export interface OpenCacheDeps {
  /** Opens/creates the SQLite-backed store. Throws on unrecoverable failure. */
  openSqliteStore: () => Promise<CacheStore>;
  /** Nukes the on-disk DB file (last-ditch recovery before memory fallback). */
  deleteDatabaseFile?: () => Promise<void>;
}

export async function openCache(deps: OpenCacheDeps): Promise<OpenCacheResult> {
  try {
    const store = await deps.openSqliteStore();
    const migration = await runMigrations(store);
    return { store, mode: 'sqlite', migration };
  } catch (firstError) {
    // Attempt a hard reset of the on-disk file, then retry once.
    if (deps.deleteDatabaseFile) {
      try {
        await deps.deleteDatabaseFile();
        const store = await deps.openSqliteStore();
        const migration = await runMigrations(store);
        return { store, mode: 'sqlite', migration };
      } catch {
        // fall through to memory
      }
    }
    const store = createMemoryStore();
    await runMigrations(store);
    return {
      store,
      mode: 'memory-fallback',
      fallbackReason: firstError instanceof Error ? firstError.name : 'unknown',
    };
  }
}
