/**
 * Postgres upsert writer for private bb_* schemas (direct connection; not PostgREST).
 */
import pg from 'pg';
import { toJsonValue } from './util.js';

export type PgWriter = {
  readonly query: (sql: string, params?: readonly unknown[]) => Promise<pg.QueryResult>;
  readonly upsertRows: (
    table: string,
    rows: readonly Record<string, unknown>[],
    conflictColumns: readonly string[],
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

export function createPgWriter(connectionString: string): PgWriter {
  const pool = new pg.Pool({ connectionString, max: 4 });

  async function query(sql: string, params: readonly unknown[] = []) {
    return pool.query(sql, [...params]);
  }

  async function upsertRows(
    table: string,
    rows: readonly Record<string, unknown>[],
    conflictColumns: readonly string[],
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const columns = Object.keys(rows[0] ?? {});
    if (columns.length === 0) return 0;

    const conflict = conflictColumns.map(quoteIdent).join(', ');
    const updateSet = columns
      .filter((c) => !conflictColumns.includes(c))
      .map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`)
      .join(', ');

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
          cells.push(prepared.castJson ? `$${param++}::jsonb` : `$${param++}`);
        }
        placeholders.push(`(${cells.join(', ')})`);
      }
      const colList = columns.map(quoteIdent).join(', ');
      const sql =
        updateSet.length > 0
          ? `INSERT INTO ${quoteIdent(table)} (${colList}) VALUES ${placeholders.join(', ')} ON CONFLICT (${conflict}) DO UPDATE SET ${updateSet}`
          : `INSERT INTO ${quoteIdent(table)} (${colList}) VALUES ${placeholders.join(', ')} ON CONFLICT (${conflict}) DO NOTHING`;
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
