/**
 * Server-only lazy Postgres pool for ops AtomicStore writes/reads against bb_* schemas.
 * Never accepts NEXT_PUBLIC_* database credentials.
 *
 * Supabase (and other managed) URLs often include `sslmode=require`. Recent node-pg treats
 * that as verify-full, which fails on the platform CA chain unless we normalize to
 * `uselibpqcompat=true` and pass `rejectUnauthorized: false` for known hosts.
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
 * Shared by ops, admin, and public web readers.
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

export function getOpsPostgresPool(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): pg.Pool {
  const connectionString = resolvePostgresConnectionString(environment);
  if (!connectionString) {
    throw new Error('DATABASE_URL or APP_DATABASE_URL is required for postgres ops store');
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

/** Test seam: tear down the module pool between cases. */
export async function __resetOpsPostgresPoolForTests(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
