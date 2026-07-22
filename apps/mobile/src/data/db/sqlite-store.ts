/**
 * expo-sqlite-backed `CacheStore` (MOB-009 §3).
 *
 * Translates the row/meta port into SQL against the schema in `schema.ts`. This
 * is the one place raw SQL lives. Its ON-DEVICE behaviour (real WAL durability,
 * a genuine mid-write process kill, actual file corruption) can only be proven
 * on a device/emulator; that integration test is DEFERRED to MOB-019's device
 * matrix (documented, not faked). The SAFETY LOGIC that sits above it — the
 * drop-and-rebuild orchestration, LRU, stamp invalidation — is fully unit-tested
 * against the in-memory store, which models identical semantics.
 */
import type { SqliteDatabase } from './sqlite-database';
import {
  CACHE_SCHEMA_VERSION,
  CREATE_ENTRIES_TABLE,
  CREATE_INDEXES,
  CREATE_META_TABLE,
  DROP_TABLES,
  ENTRIES_TABLE,
  META_TABLE,
} from './schema';
import { RELEASE_COUPLED_NAMESPACES, type CacheNamespace, type CacheStore, type StoredEntry } from './store';

interface EntryRow {
  namespace: CacheNamespace;
  key: string;
  value: string;
  release_stamp: string;
  etag: string | null;
  fetched_at: number;
  last_accessed_at: number;
  byte_length: number;
}

function toEntry(row: EntryRow): StoredEntry {
  return {
    namespace: row.namespace,
    key: row.key,
    value: row.value,
    releaseStamp: row.release_stamp,
    etag: row.etag ?? undefined,
    fetchedAt: row.fetched_at,
    lastAccessedAt: row.last_accessed_at,
    byteLength: row.byte_length,
  };
}

export function createSqliteStore(db: SqliteDatabase): CacheStore {
  return {
    async getMeta(key) {
      const row = await db.getFirstAsync<{ value: string }>(
        `SELECT value FROM ${META_TABLE} WHERE key = ?`,
        [key],
      );
      return row?.value ?? undefined;
    },
    async setMeta(key, value) {
      await db.runAsync(
        `INSERT INTO ${META_TABLE} (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value],
      );
    },

    async put(entry) {
      await db.runAsync(
        `INSERT INTO ${ENTRIES_TABLE}
           (namespace, key, value, release_stamp, etag, fetched_at, last_accessed_at, byte_length)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(namespace, key) DO UPDATE SET
           value = excluded.value,
           release_stamp = excluded.release_stamp,
           etag = excluded.etag,
           fetched_at = excluded.fetched_at,
           last_accessed_at = excluded.last_accessed_at,
           byte_length = excluded.byte_length`,
        [
          entry.namespace,
          entry.key,
          entry.value,
          entry.releaseStamp,
          entry.etag ?? null,
          entry.fetchedAt,
          entry.lastAccessedAt,
          entry.byteLength,
        ],
      );
    },
    async get(namespace, key) {
      const row = await db.getFirstAsync<EntryRow>(
        `SELECT * FROM ${ENTRIES_TABLE} WHERE namespace = ? AND key = ?`,
        [namespace, key],
      );
      return row ? toEntry(row) : undefined;
    },
    async touch(namespace, key, accessedAt) {
      await db.runAsync(
        `UPDATE ${ENTRIES_TABLE} SET last_accessed_at = ? WHERE namespace = ? AND key = ?`,
        [accessedAt, namespace, key],
      );
    },
    async delete(namespace, key) {
      await db.runAsync(`DELETE FROM ${ENTRIES_TABLE} WHERE namespace = ? AND key = ?`, [namespace, key]);
    },

    async totalBytes() {
      const row = await db.getFirstAsync<{ total: number | null }>(
        `SELECT SUM(byte_length) AS total FROM ${ENTRIES_TABLE}`,
        [],
      );
      return row?.total ?? 0;
    },
    async entriesByAccessAsc() {
      const rows = await db.getAllAsync<EntryRow>(
        `SELECT * FROM ${ENTRIES_TABLE} ORDER BY last_accessed_at ASC`,
        [],
      );
      return rows.map(toEntry);
    },

    async deleteReleaseCoupledExcept(activeStamp) {
      const placeholders = RELEASE_COUPLED_NAMESPACES.map(() => '?').join(', ');
      const result = await db.runAsync(
        `DELETE FROM ${ENTRIES_TABLE}
          WHERE namespace IN (${placeholders}) AND release_stamp != ?`,
        [...RELEASE_COUPLED_NAMESPACES, activeStamp],
      );
      return result.changes;
    },

    async dropAll() {
      await db.execAsync(DROP_TABLES);
    },
    async ensureSchema() {
      await db.execAsync(CREATE_META_TABLE);
      await db.execAsync(CREATE_ENTRIES_TABLE);
      await db.execAsync(CREATE_INDEXES);
    },
    async isHealthy() {
      try {
        // `PRAGMA integrity_check` returns 'ok' on a healthy DB. A corrupt file
        // throws or returns a non-'ok' row.
        const row = await db.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check', []);
        const value = row ? Object.values(row)[0] : undefined;
        if (value !== undefined && value !== 'ok') return false;
        // Also confirm our tables exist (a truncated file may pass integrity but
        // be missing our schema).
        const table = await db.getFirstAsync<{ name: string }>(
          `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
          [ENTRIES_TABLE],
        );
        return table !== null;
      } catch {
        return false;
      }
    },
  };
}

export { CACHE_SCHEMA_VERSION };
