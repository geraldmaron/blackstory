/**
 * Server-only lazy Postgres pool for public structured-data reads (`bb_public.*`).
 * Uses `DATABASE_URL` or `APP_DATABASE_URL`; never accepts `NEXT_PUBLIC_*` credentials.
 */
import pg from 'pg';

let pool: pg.Pool | undefined;

const FORBIDDEN_BROWSER_KEYS = ['NEXT_PUBLIC_DATABASE_URL', 'NEXT_PUBLIC_POSTGRES_URL'] as const;

export function assertNoBrowserDatabaseCredentials(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): void {
  for (const key of FORBIDDEN_BROWSER_KEYS) {
    if (environment[key]) {
      throw new Error(`${key} must never be set; database credentials cannot be public`);
    }
  }
}

/** Resolves a direct Postgres URL for server reads (service role / pooler). */
export function resolvePostgresConnectionString(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | undefined {
  assertNoBrowserDatabaseCredentials(environment);
  const url = environment.DATABASE_URL?.trim() || environment.APP_DATABASE_URL?.trim();
  return url || undefined;
}

export function getPostgresPool(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): pg.Pool {
  const connectionString = resolvePostgresConnectionString(environment);
  if (!connectionString) {
    throw new Error('DATABASE_URL or APP_DATABASE_URL is required for postgres public reads');
  }
  if (!pool) {
    const maxRaw = environment.DATABASE_POOL_MAX?.trim();
    const max = maxRaw ? Number(maxRaw) : 4;
    pool = new pg.Pool({
      connectionString,
      max: Number.isInteger(max) && max > 0 ? max : 4,
      ...(environment.DATABASE_SSL === '1' || environment.DATABASE_SSL === 'true'
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
    });
  }
  return pool;
}

export async function queryPostgres<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: readonly unknown[] = [],
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<readonly T[]> {
  const result = await getPostgresPool(environment).query<T>(sql, [...params]);
  return result.rows;
}

/** Test seam: tear down the module pool between cases. */
export async function __resetPostgresPoolForTests(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
