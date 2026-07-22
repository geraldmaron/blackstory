/**
 * Release-coupled cache repository (MOB-009 §2/§4/§5/§6).
 *
 * Sits above the `CacheStore` port and the cache policy. Responsibilities:
 *   - Write cached artifacts with the never-cache guard + size accounting +
 *     LRU eviction (ADR-022 §2).
 *   - Read cached artifacts, honouring release-stamp servability (§4): a row
 *     written under a superseded stamp is NOT served and is dropped
 *     (threat-model T5 rollback-replay).
 *   - Artifact verification (§5): before committing a freshly-fetched artifact,
 *     verify its bytes' sha-256 against the bootstrap-manifest-declared hash;
 *     on mismatch REJECT and keep the last-known-good cached copy.
 *   - Emit an explicit freshness signal (§6) the UI layer renders ("cached from
 *     X", degraded), never presenting stale as live.
 *
 * Server state lives ONLY here / in TanStack Query — never duplicated into
 * Zustand (ADR-022 §1).
 */
import { assertCacheSafe, evictIfOverCeiling, hashSearchKey } from './cache-policy';
import { hexEquals, sha256Hex, utf8ByteLength } from './hashing';
import { isEntryServable } from './release';
import type { ManifestArtifactHashRef } from './contracts';
import type { CacheNamespace, CacheStore, StoredEntry } from './db/store';
import { META_KEYS, RELEASE_COUPLED_NAMESPACES } from './db/store';

/** How a value reached the caller — drives the honest offline/staleness UI (§6). */
export interface FreshnessSignal {
  readonly source: 'network' | 'cache';
  /** Epoch ms the payload was fetched from the server. */
  readonly fetchedAt: number;
  readonly releaseStamp: string;
  /** True when served from cache while offline/degraded — UI must label it. */
  readonly degraded: boolean;
}

export interface CachedRead<T> {
  readonly value: T;
  readonly freshness: FreshnessSignal;
  readonly etag?: string;
}

/** Reject any single payload larger than this before it can bloat the cache. */
export const MAX_CACHED_ENTRY_BYTES = 4 * 1024 * 1024;

export class ArtifactVerificationError extends Error {
  constructor(readonly expected: string, readonly actual: string) {
    super('artifact hash mismatch — rejecting fetched artifact, keeping last-known-good');
    this.name = 'ArtifactVerificationError';
  }
}

export class PayloadTooLargeError extends Error {
  constructor(readonly byteLength: number) {
    super(`payload of ${byteLength} bytes exceeds per-entry cap`);
    this.name = 'PayloadTooLargeError';
  }
}

function byteLen(text: string): number {
  // Matches what the store records for size accounting (RN-safe, no Buffer).
  return utf8ByteLength(text);
}

export interface ReleaseCache {
  /** Active release stamp the client currently trusts (from bootstrap). */
  getActiveStamp(): Promise<string | undefined>;

  /**
   * Global release-stamp invalidation (ADR-022 §4). If the server stamp differs
   * from what we stored, drop ALL release-coupled rows written under other
   * stamps and record the new stamp. Idempotent + safe to call concurrently
   * (bootstrap-sync serializes callers). Returns rows invalidated.
   */
  applyReleaseStamp(serverStamp: string, fetchedAt: number): Promise<number>;

  /** Cache a value (entity/search/map). Enforces never-cache + size cap + LRU. */
  write<T>(
    namespace: CacheNamespace,
    key: string,
    value: T,
    meta: { releaseStamp: string; fetchedAt: number; etag?: string },
  ): Promise<void>;

  /**
   * Verify a freshly-fetched artifact's bytes against the manifest-declared
   * hash, then cache it. On mismatch throw ArtifactVerificationError WITHOUT
   * touching the existing cached copy (keep last-known-good, §5).
   */
  verifyAndWriteArtifact(
    key: string,
    rawBytesText: string,
    declared: ManifestArtifactHashRef,
    meta: { releaseStamp: string; fetchedAt: number; etag?: string },
  ): Promise<void>;

  /** Read a cached value if it is servable under the active stamp. A row from a
   * superseded release is dropped and treated as a miss (T5). */
  read<T>(
    namespace: CacheNamespace,
    key: string,
    opts: { activeStamp: string; degraded: boolean; now: number },
  ): Promise<CachedRead<T> | undefined>;
}

export function createReleaseCache(store: CacheStore): ReleaseCache {
  async function getActiveStamp(): Promise<string | undefined> {
    return store.getMeta(META_KEYS.releaseStamp);
  }

  async function applyReleaseStamp(serverStamp: string, fetchedAt: number): Promise<number> {
    const removed = await store.deleteReleaseCoupledExcept(serverStamp);
    await store.setMeta(META_KEYS.releaseStamp, serverStamp);
    await store.setMeta(META_KEYS.fetchedAt, String(fetchedAt));
    return removed;
  }

  async function write<T>(
    namespace: CacheNamespace,
    key: string,
    value: T,
    meta: { releaseStamp: string; fetchedAt: number; etag?: string },
  ): Promise<void> {
    // §9 tripwire — throws on a never-cache field BEFORE any serialization hits disk.
    assertCacheSafe(value);
    const serialized = JSON.stringify(value);
    const length = byteLen(serialized);
    if (length > MAX_CACHED_ENTRY_BYTES) {
      throw new PayloadTooLargeError(length);
    }
    const entry: StoredEntry = {
      namespace,
      key,
      value: serialized,
      releaseStamp: meta.releaseStamp,
      etag: meta.etag,
      fetchedAt: meta.fetchedAt,
      lastAccessedAt: meta.fetchedAt,
      byteLength: length,
    };
    await store.put(entry);
    await evictIfOverCeiling(store);
  }

  async function verifyAndWriteArtifact(
    key: string,
    rawBytesText: string,
    declared: ManifestArtifactHashRef,
    meta: { releaseStamp: string; fetchedAt: number; etag?: string },
  ): Promise<void> {
    const actual = sha256Hex(rawBytesText);
    if (!hexEquals(actual, declared.hash)) {
      // Keep last-known-good: do NOT write, do NOT delete the existing row.
      throw new ArtifactVerificationError(declared.hash, actual);
    }
    // Bytes are trusted; parse then cache under the artifact namespace.
    const parsed = JSON.parse(rawBytesText) as unknown;
    await write('artifact', key, parsed, meta);
  }

  async function read<T>(
    namespace: CacheNamespace,
    key: string,
    opts: { activeStamp: string; degraded: boolean; now: number },
  ): Promise<CachedRead<T> | undefined> {
    const row = await store.get(namespace, key);
    if (!row) return undefined;
    if (!isEntryServable(row.releaseStamp, opts.activeStamp)) {
      // Superseded release — drop and report a miss so the caller refetches (T5).
      await store.delete(namespace, key);
      return undefined;
    }
    await store.touch(namespace, key, opts.now); // LRU
    return {
      value: JSON.parse(row.value) as T,
      etag: row.etag,
      freshness: {
        source: 'cache',
        fetchedAt: row.fetchedAt,
        releaseStamp: row.releaseStamp,
        degraded: opts.degraded,
      },
    };
  }

  return { getActiveStamp, applyReleaseStamp, write, verifyAndWriteArtifact, read };
}

export { hashSearchKey, RELEASE_COUPLED_NAMESPACES };
