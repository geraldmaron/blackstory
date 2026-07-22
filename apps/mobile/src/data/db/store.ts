/**
 * Cache store port (MOB-009 §3).
 *
 * The persistence contract the cache policy, migrations, LRU eviction, release
 * invalidation and TanStack-Query persister are all written against. Two
 * implementations back it:
 *
 *   - `sqlite-store.ts` — the real expo-sqlite (ADR-020) implementation.
 *   - `memory-store.ts` — an in-memory implementation used by the unit tests
 *     AND as the degraded, memory-only fallback when the on-disk DB cannot be
 *     opened (corrupt/locked) — the app still works online, just without
 *     cross-launch offline read (ADR-022 rollback-considerations: "Disabling
 *     the persistent cache degrades to online-only fetching").
 *
 * Modelling the port at THIS level (rows + meta, not raw SQL) is deliberate:
 * all the safety-critical policy logic (drop-and-rebuild migration, LRU, stamp
 * invalidation, never-cache enforcement) becomes testable in the node test
 * runner without a native SQLite engine. The raw-SQL translation lives in one
 * thin adapter whose device-level behaviour is covered by an integration test
 * deferred to MOB-019 (see sqlite-store.ts header).
 */

/** Logical partitions of the cache. Each is release-coupled EXCEPT `meta`. */
export type CacheNamespace =
  | 'entity'
  | 'search'
  | 'map'
  | 'artifact';

export const RELEASE_COUPLED_NAMESPACES: readonly CacheNamespace[] = [
  'entity',
  'search',
  'map',
  'artifact',
];

/** One persisted cache row. `value` is opaque already-safe JSON text — the
 * store never interprets it and the never-cache enforcement (cache-policy.ts)
 * guarantees no excluded field ever reaches this shape. */
export interface StoredEntry {
  readonly namespace: CacheNamespace;
  readonly key: string;
  /** Serialized payload (JSON text). Its byte length is counted for the ceiling. */
  readonly value: string;
  /** Release stamp under which this row was fetched (ADR-022 §4). */
  readonly releaseStamp: string;
  /** Strong ETag last seen, for conditional revalidation. */
  readonly etag?: string;
  /** Epoch ms the payload was fetched (drives "last updated" + soft TTL). */
  readonly fetchedAt: number;
  /** Epoch ms of last read access (drives LRU eviction). */
  readonly lastAccessedAt: number;
  /** Byte length of `value` (denormalized so size accounting is a SUM query). */
  readonly byteLength: number;
}

export interface CacheStore {
  // --- meta (singleton key/value; NOT release-coupled) ---
  getMeta(key: string): Promise<string | undefined>;
  setMeta(key: string, value: string): Promise<void>;

  // --- entries ---
  put(entry: StoredEntry): Promise<void>;
  get(namespace: CacheNamespace, key: string): Promise<StoredEntry | undefined>;
  /** Update only `lastAccessedAt` for LRU. No-op if the row is gone. */
  touch(namespace: CacheNamespace, key: string, accessedAt: number): Promise<void>;
  delete(namespace: CacheNamespace, key: string): Promise<void>;

  /** Total byte size of all cached entry payloads (for the ceiling). */
  totalBytes(): Promise<number>;
  /** All entries ordered by `lastAccessedAt` ASC (oldest first) — LRU victims. */
  entriesByAccessAsc(): Promise<StoredEntry[]>;

  /** Delete every release-coupled row whose stamp != `activeStamp`. Returns the
   * number of rows removed. This is the ADR-022 §4 global invalidation. */
  deleteReleaseCoupledExcept(activeStamp: string): Promise<number>;

  // --- migration lifecycle ---
  /** Drop ALL cache tables (entries + meta) — the destructive migration step. */
  dropAll(): Promise<void>;
  /** (Re)create the empty schema. Idempotent. */
  ensureSchema(): Promise<void>;
  /** Cheap integrity probe; false ⇒ treat as corrupt and rebuild. */
  isHealthy(): Promise<boolean>;
}

/** Meta keys the migration/bootstrap layers own. */
export const META_KEYS = {
  schemaVersion: 'schema_version',
  migrationState: 'migration_state',
  releaseStamp: 'release_stamp',
  releaseId: 'release_id',
  fetchedAt: 'release_fetched_at',
} as const;

export type MigrationState = 'clean' | 'in_progress';
