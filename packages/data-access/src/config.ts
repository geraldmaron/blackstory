/**
 * Server-only database configuration for trusted runtimes (Cloud Run jobs).
 * Rejects browser-facing env patterns and requires an explicit role.
 */
import { assertServerOnly } from './server-only.js';
import { DATABASE_ROLES, isDatabaseRole, type DatabaseRole } from './roles.js';

export type DatabaseConfig = {
  readonly role: DatabaseRole;
  readonly connectionString?: string;
  readonly host?: string;
  readonly port: number;
  readonly database: string;
  readonly user?: string;
  readonly password?: string;
  readonly ssl: boolean;
  readonly maxPoolSize: number;
  readonly acquireTimeoutMs: number;
  readonly statementTimeoutMs: number;
  readonly idleInTransactionTimeoutMs: number;
  readonly lockTimeoutMs: number;
  readonly cloudSqlConnectionName?: string;
};

const FORBIDDEN_BROWSER_KEYS = [
  'NEXT_PUBLIC_DATABASE_URL',
  'NEXT_PUBLIC_POSTGRES_URL',
  'NEXT_PUBLIC_CLOUD_SQL_CONNECTION_NAME',
] as const;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, received ${value}`);
  }
  return parsed;
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected non-negative integer, received ${value}`);
  }
  return parsed;
}

export function assertNoBrowserDatabaseCredentials(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): void {
  for (const key of FORBIDDEN_BROWSER_KEYS) {
    if (environment[key]) {
      throw new Error(`${key} must never be set; database credentials cannot be public`);
    }
  }
}

export function parseDatabaseConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): DatabaseConfig {
  assertServerOnly('parseDatabaseConfig');
  assertNoBrowserDatabaseCredentials(environment);

  const roleRaw = environment.BLACK_BOOK_DB_ROLE ?? environment.DATABASE_ROLE;
  if (!roleRaw || !isDatabaseRole(roleRaw)) {
    throw new Error(`BLACK_BOOK_DB_ROLE must be one of: ${DATABASE_ROLES.join(', ')}`);
  }

  const connectionString = environment.DATABASE_URL ?? environment.BLACK_BOOK_DATABASE_URL;
  const host = environment.PGHOST ?? environment.DATABASE_HOST;
  const cloudSqlConnectionName = environment.CLOUD_SQL_CONNECTION_NAME;
  if (!connectionString && !host && !cloudSqlConnectionName) {
    throw new Error('Provide DATABASE_URL, PGHOST/DATABASE_HOST, or CLOUD_SQL_CONNECTION_NAME');
  }

  const maxPoolSize = parsePositiveInt(environment.DATABASE_POOL_MAX, 10);
  if (maxPoolSize > 100) {
    throw new Error('DATABASE_POOL_MAX must be <= 100');
  }

  const config: DatabaseConfig = {
    role: roleRaw,
    port: parsePositiveInt(environment.PGPORT ?? environment.DATABASE_PORT, 5432),
    database: environment.PGDATABASE ?? environment.DATABASE_NAME ?? 'blackbook',
    ssl: environment.DATABASE_SSL === '1' || environment.DATABASE_SSL === 'true',
    maxPoolSize,
    acquireTimeoutMs: parsePositiveInt(environment.DATABASE_POOL_ACQUIRE_TIMEOUT_MS, 2000),
    statementTimeoutMs: parseNonNegativeInt(environment.DATABASE_STATEMENT_TIMEOUT_MS, 30_000),
    idleInTransactionTimeoutMs: parseNonNegativeInt(
      environment.DATABASE_IDLE_IN_TX_TIMEOUT_MS,
      15_000,
    ),
    lockTimeoutMs: parseNonNegativeInt(environment.DATABASE_LOCK_TIMEOUT_MS, 5_000),
  };

  if (connectionString) {
    (config as { connectionString?: string }).connectionString = connectionString;
  }
  if (host) {
    (config as { host?: string }).host = host;
  }
  const user = environment.PGUSER ?? environment.DATABASE_USER;
  if (user) {
    (config as { user?: string }).user = user;
  }
  const password = environment.PGPASSWORD ?? environment.DATABASE_PASSWORD;
  if (password) {
    (config as { password?: string }).password = password;
  }
  if (cloudSqlConnectionName) {
    (config as { cloudSqlConnectionName?: string }).cloudSqlConnectionName = cloudSqlConnectionName;
  }

  return config;
}

export function resolveConnectionString(config: DatabaseConfig): string {
  if (config.connectionString) {
    return config.connectionString;
  }
  if (config.cloudSqlConnectionName) {
    const user = config.user ?? config.role;
    const passwordPart = config.password ? `:${encodeURIComponent(config.password)}` : '';
    return `postgresql://${user}${passwordPart}@/${config.database}?host=/cloudsql/${config.cloudSqlConnectionName}`;
  }
  const user = config.user ?? config.role;
  const passwordPart = config.password ? `:${encodeURIComponent(config.password)}` : '';
  const host = config.host ?? '127.0.0.1';
  return `postgresql://${user}${passwordPart}@${host}:${config.port}/${config.database}`;
}
