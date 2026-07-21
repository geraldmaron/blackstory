/**
 * Postgres upsert writer for private bb_* schemas (direct connection; not PostgREST).
 */
import pg from 'pg';
import { toJsonValue } from './util.js';

export type UpsertOptions = {
  /** Per-column SQL cast suffixes, e.g. `{ embedding: 'vector' }` → `$n::vector`. */
  readonly casts?: Readonly<Record<string, string>>;
  /** When true, ON CONFLICT DO NOTHING (no update). */
  readonly doNothing?: boolean;
};

export type PgWriter = {
  readonly query: (sql: string, params?: readonly unknown[]) => Promise<pg.QueryResult>;
  readonly upsertRows: (
    table: string,
    rows: readonly Record<string, unknown>[],
    conflictColumns: readonly string[],
    options?: UpsertOptions,
  ) => Promise<number>;
  readonly end: () => Promise<void>;
};

function quoteIdent(ident: string): string {
  return ident
    .split('.')
    .map((part) => `"${part.replaceAll('"', '""')}"`)
    .join('.');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function needsJsonb(value: unknown): boolean {
  if (isPlainObject(value)) return true;
  if (Array.isArray(value) && value.some((item) => isPlainObject(item) || Array.isArray(item))) {
    return true;
  }
  return false;
}

function prepareParam(value: unknown): { readonly value: unknown; readonly castJson: boolean } {
  if (value === undefined || value === null) return { value: null, castJson: false };
  if (needsJsonb(value)) {
    return { value: JSON.stringify(toJsonValue(value)), castJson: true };
  }
  return { value, castJson: false };
}

/** Normalize Supabase URLs so node-pg does not treat sslmode=require as verify-full. */
export function normalizePgConnectionString(connectionString: string): {
  readonly connectionString: string;
  readonly ssl?: { readonly rejectUnauthorized: false };
} {
  const isSupabase =
    /supabase\.(co|com)/i.test(connectionString) ||
    process.env.DATABASE_SSL === '1' ||
    process.env.DATABASE_SSL === 'true';
  if (!isSupabase) return { connectionString };
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

export function createPgWriter(connectionString: string): PgWriter {
  const conn = normalizePgConnectionString(connectionString);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    max: 4,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });

  async function query(sql: string, params: readonly unknown[] = []) {
    return pool.query(sql, [...params]);
  }

  async function upsertRows(
    table: string,
    rows: readonly Record<string, unknown>[],
    conflictColumns: readonly string[],
    options: UpsertOptions = {},
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const columns = Object.keys(rows[0] ?? {});
    if (columns.length === 0) return 0;

    const conflict = conflictColumns.map(quoteIdent).join(', ');
    const updateSet = columns
      .filter((c) => !conflictColumns.includes(c))
      .map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`)
      .join(', ');
    const casts = options.casts ?? {};

    let written = 0;
    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let param = 1;
      for (const row of batch) {
        const cells: string[] = [];
        for (const col of columns) {
          const prepared = prepareParam(row[col]);
          values.push(prepared.value);
          const cast = casts[col];
          if (cast) {
            cells.push(`$${param++}::${cast}`);
          } else if (prepared.castJson) {
            cells.push(`$${param++}::jsonb`);
          } else {
            cells.push(`$${param++}`);
          }
        }
        placeholders.push(`(${cells.join(', ')})`);
      }
      const colList = columns.map(quoteIdent).join(', ');
      const onConflict =
        options.doNothing || updateSet.length === 0
          ? `ON CONFLICT (${conflict}) DO NOTHING`
          : `ON CONFLICT (${conflict}) DO UPDATE SET ${updateSet}`;
      const sql = `INSERT INTO ${quoteIdent(table)} (${colList}) VALUES ${placeholders.join(', ')} ${onConflict}`;
      await query(sql, values);
      written += batch.length;
    }
    return written;
  }

  return {
    query,
    upsertRows,
    end: async () => {
      await pool.end();
    },
  };
}
