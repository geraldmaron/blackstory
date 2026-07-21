/**
 * Server-only lazy Postgres pool for admin structured-data reads/writes (`bb_*` schemas).
 * Uses `DATABASE_URL` or `APP_DATABASE_URL`; never accepts `NEXT_PUBLIC_*` credentials.
 *
 * Supabase URLs often include `sslmode=require`. Recent node-pg treats that as verify-full,
 * which fails on the platform CA chain unless we normalize to `uselibpqcompat=true` and
 * pass `rejectUnauthorized: false`.
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

function wantsManagedSsl(
  connectionString: string,
  environment: Readonly<Record<string, string | undefined>>,
): boolean {
  return (
    environment.DATABASE_SSL === '1' ||
    environment.DATABASE_SSL === 'true' ||
    /supabase\.(co|com)/i.test(connectionString)
  );
}

/** Normalize managed Postgres URLs so node-pg does not treat `sslmode=require` as verify-full. */
export function normalizePgConnectionString(
  connectionString: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): {
  readonly connectionString: string;
  readonly ssl?: { readonly rejectUnauthorized: false };
} {
  if (!wantsManagedSsl(connectionString, environment)) {
    return { connectionString };
  }

  let normalized = connectionString;
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    url.searchParams.set('uselibpqcompat', 'true');
    url.searchParams.set('sslmode', 'require');
    normalized = url.toString();
  } catch {
    normalized = connectionString
      .replace(/([?&])sslmode=[^&]*/g, '$1')
      .replace(/[?&]$/, '');
    const join = normalized.includes('?') ? '&' : '?';
    normalized = `${normalized}${join}uselibpqcompat=true&sslmode=require`;
  }

  return {
    connectionString: normalized,
    ssl: { rejectUnauthorized: false },
  };
}

export function getPostgresPool(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): pg.Pool {
  const connectionString = resolvePostgresConnectionString(environment);
  if (!connectionString) {
    throw new Error('DATABASE_URL or APP_DATABASE_URL is required for postgres admin reads');
  }
  if (!pool) {
    const maxRaw = environment.DATABASE_POOL_MAX?.trim();
    const max = maxRaw ? Number(maxRaw) : 4;
    const conn = normalizePgConnectionString(connectionString, environment);
    pool = new pg.Pool({
      connectionString: conn.connectionString,
      max: Number.isInteger(max) && max > 0 ? max : 4,
      ...(conn.ssl ? { ssl: conn.ssl } : {}),
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

/** Runs a callback inside a single Postgres transaction. */
export async function withPostgresTransaction<T>(
  operation: (client: pg.PoolClient) => Promise<T>,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<T> {
  const client = await getPostgresPool(environment).connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Test seam: tear down the module pool between cases. */
export async function __resetPostgresPoolForTests(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
