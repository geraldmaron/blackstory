/**
 * Enforces Postgres as the admin system of record.
 */

export type AdminDataSource = 'postgres';

type EnvironmentLike = Readonly<Record<string, string | undefined>>;

/** Rejects legacy backend selection and returns the sole supported source. */
export function resolveAdminDataSource(
  environment: EnvironmentLike = process.env,
): AdminDataSource {
  const explicit = environment.ADMIN_DATA_SOURCE?.trim().toLowerCase();
  if (explicit && explicit !== 'postgres') {
    throw new Error(`ADMIN_DATA_SOURCE=${explicit} is unsupported; Postgres is required`);
  }
  return 'postgres';
}

/** Convenience guard used by store routers. */
export function isAdminPostgresDataSource(environment: EnvironmentLike = process.env): boolean {
  return resolveAdminDataSource(environment) === 'postgres';
}
