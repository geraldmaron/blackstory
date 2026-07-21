/**
 * Degraded read-only mode helpers.
 *
 * Public pages may fall back to the bundled seed catalog when live reads are
 * explicitly disabled (`PUBLIC_READ_API_DISABLED`) or when `PUBLIC_DATA_SOURCE`
 * is not `postgres`. Under postgres SoR mode, miss/error must not substitute
 * the 4-entity Dunbar seed (same policy as `listPublicEntityViews`).
 *
 * Enable snapshot-only at runtime (non-secret):
 * PUBLIC_READ_API_DISABLED=1
 *
 * Operators can flip this in App Hosting env without redeploying secrets.
 */

import { getPublicEntity, listPublicEntities, type PublicEntityView } from '../../data/public-seed';
import { isPostgresPublicDataSource } from '../public-data/live-policy';

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
 * Resolve public entity data: live fetch first unless degraded, then optional
 * snapshot fallback. Postgres SoR refuses seed fallback so build/runtime misses
 * surface as not-found instead of baking Dunbar fixtures into `/entity/[id]`.
 */
export async function resolvePublicEntity(
  entityId: string,
  liveFetch: () => Promise<PublicEntityView | undefined>,
): Promise<PublicReadResult<PublicEntityView>> {
  if (isPublicReadApiDisabled()) {
    return { data: readEntityFromReleaseSnapshot(entityId), source: 'snapshot' };
  }

  const postgresSoR = isPostgresPublicDataSource();

  try {
    const live = await liveFetch();
    if (live !== undefined) {
      return { data: live, source: 'live' };
    }
  } catch (error) {
    if (postgresSoR) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[public-data] postgres entity resolve failed; refusing seed fallback: ${message}`,
      );
      return { data: undefined, source: 'none' };
    }
    // Non-postgres modes may fall through to the bundled seed snapshot.
  }

  if (postgresSoR) {
    console.warn(
      `[public-data] postgres entity miss for ${entityId}; refusing seed fallback`,
    );
    return { data: undefined, source: 'none' };
  }

  const snapshot = readEntityFromReleaseSnapshot(entityId);
  return { data: snapshot, source: snapshot ? 'snapshot' : 'none' };
}
