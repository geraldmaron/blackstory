/**
 * Pool bounds shared by the public read pool (`lib/public-data/postgres-client.ts`) and the admin
 * pool (`admin/lib/canonical-postgres-client.ts`). Settings only: no connection, no credentials.
 */

/**
 * Connection and statement timeouts bound how long server-rendered pages can wait on the
 * database.
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
