/**
 * Shared primitives for URL-driven desk queries (audit, graylist, and any desk added after them).
 *
 * Every desk keeps its filters in the query string so a view is bookmarkable and refresh-stable,
 * and resolves them in SQL so every row is reachable. The entity, submission and case codecs
 * predate this module and carry their own copies of these readers; new desks use this one.
 * Pure — no database, no React — so client components can import it safely.
 */

export type QueryParamInput = Readonly<Record<string, string | readonly string[] | undefined>>;

export const DESK_DEFAULT_PAGE_SIZE = 50;
const DESK_MAX_PAGE_SIZE = 200;

export function readOne(input: QueryParamInput, key: string): string | undefined {
  const value = input[key];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

/** Accepts repeated keys (`?a=1&a=2`) and the comma-joined form desks emit. */
export function readMany(input: QueryParamInput, key: string): readonly string[] {
  const value = input[key];
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const out: string[] = [];
  for (const entry of raw) {
    for (const part of entry.split(',')) {
      const trimmed = part.trim();
      if (trimmed && !out.includes(trimmed)) out.push(trimmed);
    }
  }
  return out;
}

export function readPositiveInt(input: QueryParamInput, key: string): number | undefined {
  const raw = readOne(input, key);
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** A calendar day (`YYYY-MM-DD`) that really exists, or undefined. */
export function readIsoDay(input: QueryParamInput, key: string): string | undefined {
  const raw = readOne(input, key)?.trim();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw ? undefined : raw;
}

export function normalizeDeskPageSize(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DESK_DEFAULT_PAGE_SIZE;
  return Math.min(DESK_MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
}

/** Clamp a requested page to the result set, so a stale `?page=9` lands on the last page. */
export function paginate(
  total: number,
  requestedPage: number | undefined,
  pageSize: number,
): { readonly page: number; readonly pageCount: number; readonly offset: number } {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(requestedPage ?? 1)), pageCount);
  return { page, pageCount, offset: (page - 1) * pageSize };
}

export function toggleValue(current: readonly string[] | undefined, value: string): string[] {
  const list = current ?? [];
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

export type FacetBucket = { readonly value: string; readonly count: number };
export type DeskPage<Row> = {
  readonly rows: readonly Row[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
};

/** Collects `$n` placeholders so a WHERE clause is built once and reused for rows and facets. */
export function createSqlBinder(): {
  readonly bind: (value: unknown) => string;
  readonly params: unknown[];
} {
  const params: unknown[] = [];
  return {
    params,
    bind(value) {
      params.push(value);
      return `$${params.length}`;
    },
  };
}
