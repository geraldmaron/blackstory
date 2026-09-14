/**
 * Shared Postgres connection settings for the Supabase-backed scripts in this package.
 *
 * Two jobs: normalize the connection string's SSL parameters, and BOUND the pool. The second one
 * was missing, and it failed in a way worth writing down.
 *
 * WHAT HAPPENED, 2026-09-13. `DATABASE_URL` points at `db.<ref>.supabase.co:5432` — Supabase's
 * DIRECT connection, not the pooler — which has a small fixed connection limit for the whole
 * project. This module returned only a connection string, so every caller got `pg.Pool`'s
 * defaults: up to 10 connections per pool, no connect timeout, no idle timeout, no statement
 * timeout. One script at a time, that is fine. Twenty-eight concurrent agent processes, each
 * opening its own pool, is a demand of up to 280 connections against a budget in the dozens.
 *
 * The failure mode is the part that matters: nothing errored. `pg` with no
 * `connectionTimeoutMillis` waits FOREVER for a connection. A one-row `SELECT count(*)` sat for
 * over three minutes and had to be killed, which reads as "the database is broken" rather than
 * "the pool is full" — and a caller that cannot tell those apart cannot do the right thing about
 * either. An unavailable database must not hang a caller for minutes.
 *
 * SO THE DEFAULTS HERE ARE DELIBERATE, and each one is a different failure being made loud:
 *
 *   max                     4   Not pg's 10. These are batch scripts; a fifth concurrent
 *                               statement buys almost nothing and the ceiling is shared with
 *                               every other process on the machine. Raise per-script via
 *                               PGPOOL_MAX when a script genuinely parallelizes.
 *   connectionTimeoutMillis 15s Covers TCP establishment. NOT sufficient on its own — see
 *                               `connectWithDeadline` below for the case it misses.
 *   query_timeout          15m  Client-side twin of statement_timeout, so a caller gets an error
 *                               even when the server never answers at all.
 *   idleTimeoutMillis       10s Hand connections back quickly, so a script that finishes its
 *                               queries but stays alive is not holding a slot.
 *   statement_timeout      15m  Server-side, so a runaway query dies even if the client is gone.
 *                               Generous on purpose: the publishers and backfills here run long
 *                               single statements (the release_entities table rewrite takes
 *                               minutes), and a limit that kills those would be worse than none.
 *   idle_in_transaction_
 *     session_timeout       5m  The specific killer for this project: a script interrupted
 *                               mid-transaction leaves a connection holding locks, and the next
 *                               run blocks on it with no visible cause.
 *
 * THE GAP connectionTimeoutMillis DOES NOT CLOSE, verified 2026-09-13 against this project's own
 * database while it was at its connection ceiling. `pg` arms that timer around the SOCKET connect
 * and clears it once TCP is established. Supabase's direct endpoint accepts the TCP connection at
 * the listener and only then fails to hand out a backend, so the client sits in the startup
 * exchange with no timer running. Measured: a client with connectionTimeoutMillis=4000 was still
 * waiting after several minutes, and `nc -z` to the same host and port succeeded instantly — TCP
 * was never the thing that was stuck. A connect timeout that only covers TCP is not a connect
 * timeout for this database. `connectWithDeadline` is the part that actually bounds it.
 *
 * WHY NOT JUST USE THE POOLER, which is the obvious answer to "too many connections". Supabase's
 * transaction-mode pooler (port 6543) multiplexes at statement granularity, which breaks prepared
 * statements, session-level `SET`, advisory locks and multi-statement transactions that assume one
 * backend. Scripts in this package use all of those. Session-mode pooling (port 5432 on the
 * pooler host) keeps that behavior but hands out a connection per client, so it moves the ceiling
 * rather than removing it. Bounding the pool is the change that is correct for every caller here;
 * moving to a pooler is a per-caller decision that needs its own measurement. Set
 * `DATABASE_URL` to a pooler host when a specific job wants one.
 */

/** pg.Pool config, plus the server-side timeouts, as one object a caller can spread. */
export type PgConnectionConfig = {
  readonly connectionString: string;
  readonly ssl?: { readonly rejectUnauthorized: false };
  readonly max: number;
  readonly connectionTimeoutMillis: number;
  readonly idleTimeoutMillis: number;
  readonly query_timeout: number;
  readonly options: string;
};

const DEFAULT_MAX = 4;
const DEFAULT_CONNECT_TIMEOUT_MS = 15_000;
const DEFAULT_IDLE_TIMEOUT_MS = 10_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 15 * 60_000;
const DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS = 5 * 60_000;
const DEFAULT_ACQUIRE_DEADLINE_MS = 30_000;

function positiveIntFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Acquire a client under a HARD deadline, and hand back a release function.
 *
 * This exists because `connectionTimeoutMillis` does not bound the case described above. The
 * deadline here is a plain timer raced against the acquire, so it fires whatever the connection is
 * stuck on: TCP, TLS, the startup exchange, authentication, or a pool with no free slot.
 *
 * The losing promise is NOT abandoned. A `pool.connect()` that resolves after the race is lost
 * would otherwise hold a connection open forever with nobody to release it, which is the same
 * exhaustion this is meant to diagnose, one level down. So the late client is released when it
 * eventually arrives.
 *
 * New scripts should use this. The existing ones still call `pool.connect()` directly and inherit
 * the gap; converting them is mechanical but touches enough files to be its own change.
 */
export async function connectWithDeadline<T extends { release: () => void }>(
  pool: { connect: () => Promise<T> },
  deadlineMs = positiveIntFromEnv('PG_ACQUIRE_DEADLINE_MS', DEFAULT_ACQUIRE_DEADLINE_MS),
): Promise<T> {
  const pending = pool.connect();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Attached before the race so a late arrival is always handled, and attached ONCE so the success
  // path does not also release the client it is about to return.
  void pending.then(
    (client) => {
      if (timedOut) client.release();
    },
    () => undefined,
  );

  try {
    return await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          reject(
            new Error(
              `Timed out after ${deadlineMs}ms acquiring a Postgres connection. The server may be ` +
                'at its connection ceiling: it accepts TCP and then never completes startup, which ' +
                "pg's connectionTimeoutMillis does not catch. Raise PG_ACQUIRE_DEADLINE_MS if the " +
                'wait is expected, or reduce concurrent processes.',
            ),
          );
        }, deadlineMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function normalizePgConnectionString(connectionString: string): PgConnectionConfig {
  const isSupabase =
    /supabase\.(co|com)/i.test(connectionString) ||
    process.env.DATABASE_SSL === '1' ||
    process.env.DATABASE_SSL === 'true';

  let normalized = connectionString;
  if (isSupabase) {
    try {
      const url = new URL(connectionString);
      url.searchParams.delete('sslmode');
      url.searchParams.set('uselibpqcompat', 'true');
      url.searchParams.set('sslmode', 'require');
      normalized = url.toString();
    } catch {
      normalized = connectionString;
    }
  }

  const statementTimeoutMs = positiveIntFromEnv(
    'PG_STATEMENT_TIMEOUT_MS',
    DEFAULT_STATEMENT_TIMEOUT_MS,
  );
  const idleInTransactionTimeoutMs = positiveIntFromEnv(
    'PG_IDLE_IN_TRANSACTION_TIMEOUT_MS',
    DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS,
  );

  // libpq `options` reaches the server as startup parameters, so these apply to every session the
  // pool opens without each caller remembering to `SET` them.
  const options = [
    `-c statement_timeout=${statementTimeoutMs}`,
    `-c idle_in_transaction_session_timeout=${idleInTransactionTimeoutMs}`,
  ].join(' ');

  const base = {
    connectionString: normalized,
    max: positiveIntFromEnv('PGPOOL_MAX', DEFAULT_MAX),
    connectionTimeoutMillis: positiveIntFromEnv(
      'PG_CONNECT_TIMEOUT_MS',
      DEFAULT_CONNECT_TIMEOUT_MS,
    ),
    idleTimeoutMillis: positiveIntFromEnv('PG_IDLE_TIMEOUT_MS', DEFAULT_IDLE_TIMEOUT_MS),
    query_timeout: statementTimeoutMs,
    options,
  };

  return isSupabase ? { ...base, ssl: { rejectUnauthorized: false } } : base;
}
