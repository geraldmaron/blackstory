/** Selects Postgres reads only when explicitly configured with a database URL. */
type EnvironmentLike = Readonly<Record<string, string | undefined>>;

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
 */
export function shouldUsePublicPostgresDataAccess(
  environment: EnvironmentLike = process.env,
): boolean {
  if (environment.PUBLIC_DATA_SOURCE === 'fixtures' || environment.PUBLIC_DATA_SOURCE === 'seed') {
    return false;
  }
  return isPostgresPublicDataSource(environment) && hasPostgresConnection(environment);
}
