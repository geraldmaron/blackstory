/**
 * Server-only lazy Postgres pool for public structured-data reads (`published.*`).
 * Uses `DATABASE_URL` or `APP_DATABASE_URL`; never accepts `NEXT_PUBLIC_*` credentials.
 *
 * Supabase URLs often include `sslmode=require`. Recent node-pg treats that as verify-full,
 * which fails on the platform CA chain unless we normalize to `uselibpqcompat=true` and
 * pass `rejectUnauthorized: false`. Without this, live reads throw; postgres mode must not
 * silently substitute the 4-entity Dunbar seed (map layout is also `force-dynamic`).
 */
import pg from 'pg';
import { resolvePostgresPoolSettings } from '../postgres-pool-settings';

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

/**
 * Normalize managed Postgres URLs so node-pg does not treat `sslmode=require` as verify-full.
 * Kept local to apps/web so the public render path never imports `@repo/data-access`.
 */
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
    normalized = connectionString.replace(/([?&])sslmode=[^&]*/g, '$1').replace(/[?&]$/, '');
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
    throw new Error('DATABASE_URL or APP_DATABASE_URL is required for postgres public reads');
  }
  if (!pool) {
    const conn = normalizePgConnectionString(connectionString, environment);
    pool = new pg.Pool({
      connectionString: conn.connectionString,
      // The same bounds as the admin pool. Without them a connection the database or the pooler
      // dropped never answers, and every page that reads the catalog (the map first) waits on it
      // for minutes instead of failing and retrying.
      ...resolvePostgresPoolSettings(environment),
      ...(conn.ssl ? { ssl: conn.ssl } : {}),
    });
    // An idle client erroring out (server restart, pooler eviction) emits on the pool. Without a
    // listener node treats it as an unhandled 'error' event and takes the whole server down.
    pool.on('error', (error) => {
      console.error('postgres pool client error', error);
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
