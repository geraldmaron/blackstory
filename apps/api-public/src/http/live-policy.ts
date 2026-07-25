/**
 * Decides when `apps/api-public` binds `PublicDataAccess` to live Postgres `bb_public` reads or
 * the injected in-memory adapter.
 *
 * Mirrors `apps/web/src/lib/public-data/live-policy.ts` vocabulary (`PUBLIC_DATA_SOURCE`,
 * `DATABASE_URL`, `PUBLIC_READ_API_DISABLED`) so operators configure web and api-public with one
 * convention. Postgres is the only production SoR path (ADR-020) — the legacy Firestore read
 * branch was removed (repo-348e.3); there is no fallback to Firestore, silent or explicit.
 */
import { hasEmulatorSignals, type EnvironmentLike } from '@repo/firebase';

export type PublicDataSource = 'seed' | 'postgres' | 'fixtures';

export function resolvePublicDataSource(
  environment: EnvironmentLike = process.env,
): PublicDataSource | undefined {
  const raw = environment.PUBLIC_DATA_SOURCE?.trim().toLowerCase();
  if (raw === 'seed' || raw === 'postgres' || raw === 'fixtures') {
    return raw;
  }
  return undefined;
}

export function isPostgresPublicDataSource(environment: EnvironmentLike = process.env): boolean {
  return resolvePublicDataSource(environment) === 'postgres';
}

function hasPostgresConnection(environment: EnvironmentLike): boolean {
  return Boolean(environment.DATABASE_URL?.trim() || environment.APP_DATABASE_URL?.trim());
}

/**
 * Primary live path: explicit `PUBLIC_DATA_SOURCE=postgres` plus a server-only DB URL.
 * Never inferred from Firebase project id alone.
 */
export function shouldUsePublicPostgresDataAccess(
  environment: EnvironmentLike = process.env,
): boolean {
  if (
    environment.PUBLIC_READ_API_DISABLED === '1' ||
    environment.PUBLIC_READ_API_DISABLED === 'true'
  ) {
    return false;
  }
  if (
    environment.PUBLIC_DATA_SOURCE === 'fixtures' ||
    environment.PUBLIC_DATA_SOURCE === 'seed'
  ) {
    return false;
  }
  if (hasEmulatorSignals(environment)) {
    return false;
  }
  return isPostgresPublicDataSource(environment) && hasPostgresConnection(environment);
}

/** @deprecated Prefer `shouldUsePublicPostgresDataAccess` for new deployments. */
export function shouldUsePublicLiveDataAccess(environment: EnvironmentLike = process.env): boolean {
  return shouldUsePublicPostgresDataAccess(environment);
}
