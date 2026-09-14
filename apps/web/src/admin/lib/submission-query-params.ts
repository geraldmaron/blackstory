/**
 * URL <-> SubmissionQuery codec for the submissions queue (`/admin/submissions`).
 *
 * Same shape and reasoning as `entity-query-params.ts`: every filter lives in the query string so
 * a view is bookmarkable and survives refresh, and the default view (status=quarantined, the
 * actionable queue) serializes to an empty query string rather than a URL an operator has to
 * type. Pure, no database or React dependency.
 */
import {
  DEFAULT_PAGE_SIZE,
  INTAKE_STATUSES,
  normalizePageSize,
  type SubmissionQuery,
} from './postgres-submissions.js';

export type QueryParamInput = Readonly<Record<string, string | readonly string[] | undefined>>;

/** The queue an operator lands on: submissions still waiting on a decision. */
const DEFAULT_STATUSES: readonly string[] = ['quarantined'];

function readOne(input: QueryParamInput, key: string): string | undefined {
  const value = input[key];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

/** Accepts both repeated keys (`?status=a&status=b`) and the comma-joined form we emit. */
function readMany(input: QueryParamInput, key: string): readonly string[] {
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

function readPositiveInt(input: QueryParamInput, key: string): number | undefined {
  const raw = readOne(input, key);
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** Parse a Next.js `searchParams` object into a validated SubmissionQuery. Unknowns fall back. */
export function parseSubmissionQuery(input: QueryParamInput): SubmissionQuery {
  const search = readOne(input, 'q')?.trim();
  const statusesRaw = readMany(input, 'status').filter((value) =>
    (INTAKE_STATUSES as readonly string[]).includes(value),
  );
  const statuses = statusesRaw.length > 0 ? statusesRaw : DEFAULT_STATUSES;
  const kinds = readMany(input, 'kind');

  const directionRaw = readOne(input, 'dir');
  const direction: 'asc' | 'desc' = directionRaw === 'asc' ? 'asc' : 'desc';

  return {
    ...(search ? { search } : {}),
    statuses,
    ...(kinds.length ? { kinds } : {}),
    direction,
    page: readPositiveInt(input, 'page') ?? 1,
    pageSize: normalizePageSize(readPositiveInt(input, 'size')),
  };
}

function isDefaultStatuses(statuses: readonly string[] | undefined): boolean {
  if (!statuses || statuses.length !== DEFAULT_STATUSES.length) return false;
  return statuses.every((value, index) => value === DEFAULT_STATUSES[index]);
}

/** Serialize back to a query string, omitting defaults. Round-trips with parseSubmissionQuery. */
export function serializeSubmissionQuery(query: SubmissionQuery): string {
  const params = new URLSearchParams();

  if (query.search?.trim()) params.set('q', query.search.trim());
  if (query.statuses?.length && !isDefaultStatuses(query.statuses)) {
    params.set('status', query.statuses.join(','));
  }
  if (query.kinds?.length) params.set('kind', query.kinds.join(','));
  if (query.direction && query.direction !== 'desc') params.set('dir', query.direction);
  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.pageSize && query.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set('size', String(query.pageSize));
  }

  return params.toString();
}

/**
 * Apply a change to a query and return the new href. Any filter change resets to page 1 —
 * staying on page 7 of a result set that just shrank is the classic faceted-browser dead end.
 */
export function submissionQueryHref(
  basePath: string,
  query: SubmissionQuery,
  patch: Partial<SubmissionQuery>,
): string {
  const resetsPage = Object.keys(patch).some((key) => key !== 'page');
  const next: SubmissionQuery = { ...query, ...patch, ...(resetsPage ? { page: 1 } : {}) };
  const serialized = serializeSubmissionQuery(next);
  return serialized ? `${basePath}?${serialized}` : basePath;
}

/** Toggle one value within a multi-select facet, returning the new href. */
export function toggleSubmissionFacetHref(
  basePath: string,
  query: SubmissionQuery,
  key: 'statuses' | 'kinds',
  value: string,
): string {
  const current = query[key] ?? [];
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
  return submissionQueryHref(basePath, query, { [key]: next } as Partial<SubmissionQuery>);
}

/** True when the view differs from the default quarantined queue — drives "Clear filters". */
export function hasActiveSubmissionFilters(query: SubmissionQuery): boolean {
  return Boolean(query.search?.trim() || query.kinds?.length || !isDefaultStatuses(query.statuses));
}
