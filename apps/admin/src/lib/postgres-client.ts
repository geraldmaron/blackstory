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
    normalized = connectionString.replace(/([?&])sslmode=[^&]*/g, '$1').replace(/[?&]$/, '');
    const join = normalized.includes('?') ? '&' : '?';
    normalized = `${normalized}${join}uselibpqcompat=true&sslmode=require`;
  }

  return {
    connectionString: normalized,
    ssl: { rejectUnauthorized: false },
  };
}

/**
 * Timeout budget. Pages are server-rendered, so first byte waits on these queries: an
 * unreachable database used to hang a render for minutes (repo-7pqy measured `GET / 200 in
 * 18.4min`) because the pool had no connect or statement bound at all. Every number here is a
 * ceiling on how long a page can be stuck, not a performance tuning knob.
 */
export const POSTGRES_TIMEOUT_DEFAULTS = {
  /** Give up reaching the host. Covers a wrong pooler host or a dropped IPv6 route. */
  connectionTimeoutMillis: 5_000,
  /** Server-side cap: Postgres itself cancels the query, so a slow scan cannot pin a render. */
  statementTimeoutMillis: 10_000,
  /** Client-side cap, slightly above statement_timeout, for a connection that stops answering. */
  queryTimeoutMillis: 12_000,
  /** Reap idle connections so a restarted database does not hand back dead sockets. */
  idleTimeoutMillis: 30_000,
  max: 4,
} as const;

function readPositiveInteger(raw: string | undefined, fallback: number): number {
  const value = raw?.trim() ? Number(raw) : Number.NaN;
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function resolvePostgresPoolSettings(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): {
  readonly max: number;
  readonly connectionTimeoutMillis: number;
  readonly idleTimeoutMillis: number;
  readonly query_timeout: number;
  readonly statement_timeout: number;
} {
  const statementTimeout = readPositiveInteger(
    environment.DATABASE_STATEMENT_TIMEOUT_MS,
    POSTGRES_TIMEOUT_DEFAULTS.statementTimeoutMillis,
  );
  return {
    max: readPositiveInteger(environment.DATABASE_POOL_MAX, POSTGRES_TIMEOUT_DEFAULTS.max),
    connectionTimeoutMillis: readPositiveInteger(
      environment.DATABASE_CONNECT_TIMEOUT_MS,
      POSTGRES_TIMEOUT_DEFAULTS.connectionTimeoutMillis,
    ),
    idleTimeoutMillis: readPositiveInteger(
      environment.DATABASE_IDLE_TIMEOUT_MS,
      POSTGRES_TIMEOUT_DEFAULTS.idleTimeoutMillis,
    ),
    statement_timeout: statementTimeout,
    // Always above statement_timeout so Postgres cancels first and we see the real error.
    query_timeout: Math.max(
      statementTimeout + 2_000,
      readPositiveInteger(
        environment.DATABASE_QUERY_TIMEOUT_MS,
        POSTGRES_TIMEOUT_DEFAULTS.queryTimeoutMillis,
      ),
    ),
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
    const conn = normalizePgConnectionString(connectionString, environment);
    pool = new pg.Pool({
      connectionString: conn.connectionString,
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

/** True when a failure is the database being unreachable or too slow, not a bad query. */
export function isPostgresUnavailableError(error: unknown): boolean {
  if (!error) return false;
  const code = (error as { code?: unknown }).code;
  const message = error instanceof Error ? error.message : String(error);
  return (
    // Postgres cancels on statement_timeout; node-pg raises the rest.
    code === '57014' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENETUNREACH' ||
    /timeout|terminated unexpectedly|Connection terminated|ECONNRESET|canceling statement/i.test(
      message,
    )
  );
}

export type PostgresReadOutcome<T> =
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'degraded'; readonly reason: string };

/**
 * Run a read and degrade instead of hanging or throwing into the render. Server components use
 * this so an unreachable database costs a page section, not the whole page — and costs seconds,
 * not minutes.
 */
export async function readPostgresOrDegrade<T>(
  read: () => Promise<T>,
  label: string,
): Promise<PostgresReadOutcome<T>> {
  try {
    return { status: 'ok', value: await read() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isPostgresUnavailableError(error)) {
      console.error(`postgres read degraded (${label})`, message);
      return { status: 'degraded', reason: message };
    }
    throw error;
  }
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
