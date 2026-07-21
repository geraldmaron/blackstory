/**
 * Policy for when the web app should attempt canonical Postgres public projection reads.
 */

export type PublicDataSource = 'seed' | 'postgres';

type EnvironmentLike = Readonly<Record<string, string | undefined>>;

export function resolvePublicDataSource(env: EnvironmentLike = process.env): PublicDataSource | undefined {
  const raw = env.PUBLIC_DATA_SOURCE?.trim().toLowerCase();
  if (raw === 'seed' || raw === 'postgres') {
    return raw;
  }
  return undefined;
}

export function isPostgresPublicDataSource(env: EnvironmentLike = process.env): boolean {
  return resolvePublicDataSource(env) === 'postgres';
}

/**
 * Whether list/map/search may prefer ADR-004 CDN/local `entities.json` artifacts.
 * Postgres mode always reads `bb_public` instead — fixtures and stale GCS slices must not
 * shadow the system of record.
 */
export function shouldPreferReleaseArtifacts(env: EnvironmentLike = process.env): boolean {
  // Only skip artifacts when Postgres is the explicit SoR. Seed / unset still allow
  // ADR-004 CDN/local entities.json as a read-through cache.
  return resolvePublicDataSource(env) !== 'postgres';
}

function hasPostgresConnection(env: EnvironmentLike): boolean {
  return Boolean(env.DATABASE_URL?.trim() || env.APP_DATABASE_URL?.trim());
}

/** Whether this runtime should attempt live public projection reads.  */
export function shouldUseLivePublicProjections(env: EnvironmentLike = process.env): boolean {
  if (env.PUBLIC_READ_API_DISABLED === '1' || env.PUBLIC_READ_API_DISABLED === 'true') {
    return false;
  }
  if (env.PUBLIC_DATA_SOURCE === 'seed') {
    return false;
  }
  return isPostgresPublicDataSource(env) && hasPostgresConnection(env);
}
