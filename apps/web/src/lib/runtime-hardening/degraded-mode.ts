/**
 * Degraded read-only mode helpers.
 *
 * Public pages must remain readable from release snapshots when live read APIs
 * throttle or are disabled. Today the seed catalog in `public-seed.ts` stands in
 * for immutable release snapshots until projection fetchers land.
 *
 * Enable at runtime (non-secret):
 * PUBLIC_READ_API_DISABLED=1
 *
 * Operators can flip this in App Hosting env without redeploying secrets.
 */

import { getPublicEntity, listPublicEntities, type PublicEntityView } from '../../data/public-seed';

export type PublicReadSource = 'live' | 'snapshot' | 'none';

export interface PublicReadResult<T> {
  readonly data: T | undefined;
  readonly source: PublicReadSource;
}

/** True when live public read APIs must not be called (snapshot-only posture).  */
export function isPublicReadApiDisabled(): boolean {
  const flag = process.env.PUBLIC_READ_API_DISABLED;
  return flag === '1' || flag === 'true';
}

/** Read a single entity from the bundled release snapshot catalog.  */
export function readEntityFromReleaseSnapshot(entityId: string): PublicEntityView | undefined {
  return getPublicEntity(entityId);
}

/** List all entities available in the bundled release snapshot catalog.  */
export function listEntitiesFromReleaseSnapshot(): readonly PublicEntityView[] {
  return listPublicEntities();
}

/**
 * Resolve public entity data: live fetch first unless degraded, then snapshot fallback.
 * `liveFetch` will be wired to api-public in; until then callers pass seed reads.
 */
export async function resolvePublicEntity(
  entityId: string,
  liveFetch: () => Promise<PublicEntityView | undefined>,
): Promise<PublicReadResult<PublicEntityView>> {
  if (isPublicReadApiDisabled()) {
    return { data: readEntityFromReleaseSnapshot(entityId), source: 'snapshot' };
  }

  try {
    const live = await liveFetch();
    if (live !== undefined) {
      return { data: live, source: 'live' };
    }
  } catch {
    // fall through to snapshot
  }

  const snapshot = readEntityFromReleaseSnapshot(entityId);
  return { data: snapshot, source: snapshot ? 'snapshot' : 'none' };
}
