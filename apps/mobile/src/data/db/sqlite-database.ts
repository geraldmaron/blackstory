/**
 * expo-sqlite handle (MOB-009 §3 / ADR-020 chose expo-sqlite).
 *
 * `SqliteDatabase` is the minimal subset of `expo-sqlite`'s `SQLiteDatabase`
 * the store adapter uses. Isolating it here keeps `sqlite-store.ts` free of a
 * direct `expo-sqlite` import so the SQL translation can be exercised against a
 * driver double if ever needed, and — crucially — so importing the store types
 * never drags the native module into the jest runtime.
 *
 * `openMobileDatabase()` is the ONLY module that imports `expo-sqlite`. It is
 * not imported by any unit test.
 */

export interface SqliteRunResult {
  readonly lastInsertRowId: number;
  readonly changes: number;
}

/** The exact expo-sqlite methods the adapter relies on. */
export interface SqliteDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: readonly (string | number | null)[]): Promise<SqliteRunResult>;
  getFirstAsync<T>(source: string, params: readonly (string | number | null)[]): Promise<T | null>;
  getAllAsync<T>(source: string, params: readonly (string | number | null)[]): Promise<T[]>;
  closeAsync(): Promise<void>;
}

export const MOBILE_DB_NAME = 'blackstory-cache.db';

/**
 * Opens (or creates) the on-disk cache database. Throws if the native store is
 * unavailable/corrupt beyond recovery — the caller (`openCacheStore`) catches
 * that and falls back to the memory store so the app still runs online.
 */
export async function openMobileDatabase(): Promise<SqliteDatabase> {
  // Lazy import keeps the native module out of any code path a test might load.
  const SQLite = await import('expo-sqlite');
  const db = await SQLite.openDatabaseAsync(MOBILE_DB_NAME);
  // WAL improves resilience to mid-write termination.
  await db.execAsync('PRAGMA journal_mode = WAL;');
  return db as unknown as SqliteDatabase;
}

/** Deletes the on-disk database file entirely — the nuclear recovery path used
 * when even a drop-and-rebuild fails (e.g. an unreadable file). */
export async function deleteMobileDatabase(): Promise<void> {
  const SQLite = await import('expo-sqlite');
  await SQLite.deleteDatabaseAsync(MOBILE_DB_NAME);
}
