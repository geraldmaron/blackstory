/**
 * On-disk cache schema (MOB-009 §3 / ADR-022 §5).
 *
 * The schema version is a SINGLE integer. When the app's expected version does
 * not match what is on disk, the migration is DROP-AND-REBUILD (ADR-022 §5) —
 * there is deliberately no ALTER path. Bump `CACHE_SCHEMA_VERSION` on ANY shape
 * change; the next launch wipes and repopulates from the network.
 *
 * The DDL string constants here are consumed only by the expo-sqlite adapter
 * (`sqlite-store.ts`); the in-memory store models the same tables as Maps.
 */

/** Bump on any cache table shape change → forces a drop-and-rebuild next launch. */
export const CACHE_SCHEMA_VERSION = 1;

export const ENTRIES_TABLE = 'cache_entries';
export const META_TABLE = 'cache_meta';

/**
 * NOTE: there is intentionally NO table for query text, correction content, or
 * precise location (ADR-022 §2 never-cache list; program invariant 7). The
 * schema itself is the structural guarantee that those categories have nowhere
 * to land on disk.
 */
export const CREATE_META_TABLE = `
  CREATE TABLE IF NOT EXISTS ${META_TABLE} (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
`;

export const CREATE_ENTRIES_TABLE = `
  CREATE TABLE IF NOT EXISTS ${ENTRIES_TABLE} (
    namespace        TEXT NOT NULL,
    key              TEXT NOT NULL,
    value            TEXT NOT NULL,
    release_stamp    TEXT NOT NULL,
    etag             TEXT,
    fetched_at       INTEGER NOT NULL,
    last_accessed_at INTEGER NOT NULL,
    byte_length      INTEGER NOT NULL,
    PRIMARY KEY (namespace, key)
  );
`;

export const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_entries_access ON ${ENTRIES_TABLE} (last_accessed_at);
  CREATE INDEX IF NOT EXISTS idx_entries_stamp  ON ${ENTRIES_TABLE} (release_stamp);
`;

export const DROP_TABLES = `
  DROP TABLE IF EXISTS ${ENTRIES_TABLE};
  DROP TABLE IF EXISTS ${META_TABLE};
`;
