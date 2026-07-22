/**
 * Mobile data layer (MOB-009 / ADR-022).
 *
 * Public surface: typed transport, SQLite cache, release-stamp invalidation,
 * bootstrap sync, artifact verification, offline signal, secure-store, and the
 * TanStack Query wiring. Feature code (MOB-012+) consumes THIS, not the internals.
 *
 * The native modules (expo-sqlite, expo-secure-store, NetInfo) are only reached
 * through the lazy factories below (`createRuntimeCache`), so importing this
 * barrel does not eagerly load a native module — tests import the specific pure
 * modules directly.
 */
export { createTransport, createSupersedingRunner, TransportError, MAX_RESPONSE_BYTES, DEFAULT_RETRY_POLICY, parseRetryAfter } from './transport';
export type { Transport, ReadResult, ReadOptions, TransportRetryPolicy } from './transport';

export { createReleaseCache, ArtifactVerificationError, PayloadTooLargeError, hashSearchKey } from './release-cache';
export type { ReleaseCache, FreshnessSignal, CachedRead } from './release-cache';

export { isReleaseStampStale, isEntryServable } from './release';
export { createBootstrapSynchronizer, deriveEndpointStamp, BOOTSTRAP_PATH } from './bootstrap-sync';
export type { BootstrapSynchronizer, SyncResult } from './bootstrap-sync';

export {
  CACHE_BYTE_CEILING,
  CACHE_LOW_WATER,
  assertCacheSafe,
  isNeverCacheKey,
  NeverCacheViolation,
  evictIfOverCeiling,
} from './cache-policy';

export { clearCache, cacheDiagnostics } from './diagnostics';
export type { CacheDiagnostics } from './diagnostics';

export { openCache } from './open-cache';
export type { OpenCacheResult, CacheMode } from './open-cache';

export { runMigrations } from './db/migrations';
export type { MigrationOutcome } from './db/migrations';
export { CACHE_SCHEMA_VERSION } from './db/schema';
export { createMemoryStore } from './db/memory-store';
export { createSqliteStore } from './db/sqlite-store';
export { META_KEYS, RELEASE_COUPLED_NAMESPACES } from './db/store';
export type { CacheStore, StoredEntry, CacheNamespace } from './db/store';

export { createManualConnectivity, createNetInfoConnectivity } from './offline';
export type { Connectivity, ConnectivityState } from './offline';

export { createSecretStore, assertSmallSecret, SECRET_KEYS, MAX_SECRET_BYTES, SecretTooLargeError } from './secure-store';
export type { SecretStore, SecretKey, SecretBackend } from './secure-store';

export { createMobileQueryClient, createSqlitePersister, shouldPersistQuery, mobileDehydrateOptions } from './query-client';

export type { BootstrapResponseV1, EntityV1, ReleaseManifestView, ManifestArtifactHashRef } from './contracts';

import { openCache, type OpenCacheResult } from './open-cache';
import { createSqliteStore } from './db/sqlite-store';
import { openMobileDatabase, deleteMobileDatabase } from './db/sqlite-database';

/**
 * Opens the real on-disk cache with the full degradation ladder (open-cache.ts).
 * The only runtime entry point that binds expo-sqlite; call once at app start.
 */
export async function createRuntimeCache(): Promise<OpenCacheResult> {
  return openCache({
    openSqliteStore: async () => createSqliteStore(await openMobileDatabase()),
    deleteDatabaseFile: deleteMobileDatabase,
  });
}
