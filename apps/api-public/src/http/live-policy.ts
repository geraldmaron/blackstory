/**
 * Decides when `apps/api-public` binds `PublicDataAccess` to live Postgres `bb_public` reads,
 * legacy Firestore projections, or the injected in-memory adapter.
 *
 * Mirrors `apps/web/src/lib/public-data/live-policy.ts` vocabulary (`PUBLIC_DATA_SOURCE`,
 * `DATABASE_URL`, `PUBLIC_READ_API_DISABLED`) so operators configure web and api-public with one
 * convention. Postgres is the production SoR path (ADR-020); Firestore requires an explicit
 * `PUBLIC_DATA_SOURCE=firestore` opt-in during wind-down — never a silent production default.
 */
import {
  hasEmulatorSignals,
  PRODUCTION_BREAK_GLASS_ENV,
  PRODUCTION_PROJECT_ID,
  type EnvironmentLike,
} from '@repo/firebase';

export type PublicDataSource = 'seed' | 'postgres' | 'firestore' | 'fixtures';

export function resolvePublicDataSource(
  environment: EnvironmentLike = process.env,
): PublicDataSource | undefined {
  const raw = environment.PUBLIC_DATA_SOURCE?.trim().toLowerCase();
  if (raw === 'seed' || raw === 'postgres' || raw === 'firestore' || raw === 'fixtures') {
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

/**
 * Legacy Firestore path — explicit opt-in only (`PUBLIC_DATA_SOURCE=firestore`) plus the same
 * production/break-glass gate used before the Postgres cutover. Not selected when unset.
 */
export function shouldUsePublicFirestoreDataAccess(
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
    environment.PUBLIC_DATA_SOURCE === 'seed' ||
    environment.PUBLIC_DATA_SOURCE === 'postgres'
  ) {
    return false;
  }
  if (resolvePublicDataSource(environment) !== 'firestore') {
    return false;
  }
  if (hasEmulatorSignals(environment)) {
    return false;
  }

  const projectId =
    environment.FIREBASE_PROJECT_ID?.trim() || environment.GOOGLE_CLOUD_PROJECT?.trim();
  if (projectId !== PRODUCTION_PROJECT_ID && environment.PUBLIC_DATA_SOURCE !== 'firestore') {
    return false;
  }

  const nodeEnv = environment.NODE_ENV ?? environment.BLACK_BOOK_ENV ?? 'development';
  if (nodeEnv !== 'production' && environment[PRODUCTION_BREAK_GLASS_ENV] !== '1') {
    return false;
  }

  return true;
}

/** @deprecated Prefer `shouldUsePublicPostgresDataAccess` for new deployments. */
export function shouldUsePublicLiveDataAccess(environment: EnvironmentLike = process.env): boolean {
  return (
    shouldUsePublicPostgresDataAccess(environment) ||
    shouldUsePublicFirestoreDataAccess(environment)
  );
}
