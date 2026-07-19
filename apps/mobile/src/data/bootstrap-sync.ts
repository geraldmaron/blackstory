/**
 * Bootstrap synchronization (MOB-009 §4; threat-model T5/T7).
 *
 * On launch (and on foreground / periodically) fetch `/v1/bootstrap`, compare
 * the server's active release stamp to the locally cached one (ADR-022 §4), and
 * invalidate the stale release-coupled cache.
 *
 * STAMP SOURCE — important nuance, honestly documented. The `/v1/bootstrap`
 * WIRE response (`bootstrapResponseV1Schema`) is a PROJECTION that carries
 * `activeRelease.releaseId` but NOT the fuller `releaseStamp`
 * (`releaseId@<hash>`), which lives only in the downloadable bootstrap manifest
 * artifact (MOB-005 `mobile-bootstrap.ts`). Per that module's own reasoning
 * ("The releaseId alone is enough to distinguish two releases — they are always
 * minted with fresh ids"), the client uses `releaseId` as its single global
 * invalidation stamp from the endpoint. The fuller `releaseStamp` is used only
 * where the client fetches the manifest artifact for hash provenance
 * (release-cache.verifyAndWriteArtifact). Both are compared purely for equality,
 * so a rollback to a prior release (a DIFFERENT id) invalidates identically to a
 * roll-forward (T5 — never assume monotonicity).
 *
 * CONCURRENCY — duplicate/concurrent sync attempts must not double-invalidate or
 * race. `createBootstrapSynchronizer` single-flights: overlapping calls share
 * the one in-flight promise (request de-dup, ADR-022 §1).
 */
import type { BootstrapResponseV1 } from './contracts';
import { isReleaseStampStale } from './release';
import type { ReleaseCache } from './release-cache';
import type { Transport } from './transport';
import { META_KEYS } from './db/store';
import type { CacheStore } from './db/store';

export const BOOTSTRAP_PATH = '/v1/bootstrap';

/** The client's global invalidation stamp derived from the endpoint projection. */
export function deriveEndpointStamp(bootstrap: BootstrapResponseV1): string {
  return bootstrap.activeRelease.releaseId;
}

export type SyncResult =
  | { readonly status: 'unchanged'; readonly stamp: string }
  | { readonly status: 'invalidated'; readonly stamp: string; readonly rowsInvalidated: number }
  | { readonly status: 'not-modified'; readonly stamp: string | undefined }
  | { readonly status: 'offline'; readonly stamp: string | undefined };

export interface BootstrapSynchronizer {
  sync(now?: number): Promise<SyncResult>;
}

export function createBootstrapSynchronizer(deps: {
  readonly transport: Transport;
  readonly cache: ReleaseCache;
  readonly store: CacheStore;
  readonly now?: () => number;
}): BootstrapSynchronizer {
  const now = deps.now ?? Date.now;
  let inFlight: Promise<SyncResult> | null = null;

  async function doSync(at: number): Promise<SyncResult> {
    const priorStamp = await deps.cache.getActiveStamp();
    const priorEtag = await deps.store.getMeta('bootstrap_etag');

    let result;
    try {
      result = await deps.transport.readJson<BootstrapResponseV1>(BOOTSTRAP_PATH, {
        etag: priorEtag,
      });
    } catch {
      // No connectivity / server unreachable — DO NOT invalidate. We keep the
      // last-known stamp and serve cache honestly (T7: never trust the absence
      // of a fresh response as a reason to drop data).
      return { status: 'offline', stamp: priorStamp };
    }

    if (result.kind === 'not-modified') {
      // Server confirms same release; nothing to invalidate.
      return { status: 'not-modified', stamp: priorStamp };
    }

    const serverStamp = deriveEndpointStamp(result.data);
    if (result.etag) await deps.store.setMeta('bootstrap_etag', result.etag);

    if (!isReleaseStampStale(priorStamp, serverStamp)) {
      // Refresh fetchedAt so "last updated" stays honest even when unchanged.
      await deps.store.setMeta(META_KEYS.fetchedAt, String(at));
      return { status: 'unchanged', stamp: serverStamp };
    }

    const rowsInvalidated = await deps.cache.applyReleaseStamp(serverStamp, at);
    await deps.store.setMeta(META_KEYS.releaseId, result.data.activeRelease.releaseId);
    return { status: 'invalidated', stamp: serverStamp, rowsInvalidated };
  }

  return {
    async sync(at = now()) {
      // Single-flight: coalesce concurrent/duplicate callers onto one request.
      if (inFlight) return inFlight;
      inFlight = doSync(at).finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
}
