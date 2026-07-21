/**
 * Ops/admin structured-data source selection for Postgres SoR cutover.
 * Explicit ADMIN_DATA_SOURCE or OPS_DATA_SOURCE wins; otherwise DATABASE_URL implies postgres.
 */
export type OpsDataSource = 'postgres';

export function resolveOpsDataSource(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): OpsDataSource {
  const explicit = (
    environment.OPS_DATA_SOURCE?.trim() ||
    environment.ADMIN_DATA_SOURCE?.trim() ||
    ''
  ).toLowerCase();
  if (explicit && explicit !== 'postgres') {
    throw new Error(`Unsupported ops data source ${explicit}; Postgres is required`);
  }
  if (environment.DATABASE_URL?.trim() || environment.APP_DATABASE_URL?.trim()) {
    return 'postgres';
  }
  return 'postgres';
}

export function isOpsPostgresDataSource(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return resolveOpsDataSource(environment) === 'postgres';
}
