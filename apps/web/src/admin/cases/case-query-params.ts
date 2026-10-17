/**
 * URL <-> CaseQuery codec for the research-case queues (`/admin/inbox`, `/admin/cases`).
 *
 * Same shape and reasoning as `submission-query-params.ts`: every filter lives in the query string
 * so a view is bookmarkable and survives refresh, and a queue's default view serializes to an empty
 * query string. The two routes differ only in their default state filter: the Inbox starts on the
 * three triage states, the full browser starts on every state. Pure; no database or React.
 */
import {
  CASE_DEFAULT_PAGE_SIZE,
  CASE_SORT_KEYS,
  normalizeCasePageSize,
  type CaseAssigneeFilter,
  type CaseQuery,
  type CaseSortKey,
} from './case-query-types';
import { ALL_CASE_STATES, INBOX_CASE_STATES } from './research-case-types';

export type CaseQueueMode = 'inbox' | 'cases';
export type QueryParamInput = Readonly<Record<string, string | readonly string[] | undefined>>;

const ASSIGNEES: readonly CaseAssigneeFilter[] = ['any', 'assigned', 'unassigned'];

/** The states a queue shows before the operator narrows it. Empty means "no state filter". */
export function defaultCaseStates(mode: CaseQueueMode): readonly string[] {
  return mode === 'inbox' ? INBOX_CASE_STATES : [];
}

function readOne(input: QueryParamInput, key: string): string | undefined {
  const value = input[key];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

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

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

/** Parse a Next.js `searchParams` object into a validated CaseQuery. Unknown values fall back. */
export function parseCaseQuery(input: QueryParamInput, mode: CaseQueueMode): CaseQuery {
  const search = readOne(input, 'q')?.trim();
  const requested = readMany(input, 'state').filter((value) =>
    (ALL_CASE_STATES as readonly string[]).includes(value),
  );
  const states = requested.length > 0 ? requested : defaultCaseStates(mode);

  const assigneeRaw = readOne(input, 'assignee') as CaseAssigneeFilter | undefined;
  const assignee = assigneeRaw && ASSIGNEES.includes(assigneeRaw) ? assigneeRaw : 'any';

  const sortRaw = readOne(input, 'sort') as CaseSortKey | undefined;
  const sort = sortRaw && CASE_SORT_KEYS.includes(sortRaw) ? sortRaw : 'updated';
  const direction = readOne(input, 'dir') === 'asc' ? 'asc' : 'desc';

  return {
    ...(search ? { search } : {}),
    ...(states.length ? { states } : {}),
    assignee,
    sort,
    direction,
    page: readPositiveInt(input, 'page') ?? 1,
    pageSize: normalizeCasePageSize(readPositiveInt(input, 'size')),
  };
}

/** Serialize back to a query string, omitting defaults. Round-trips with parseCaseQuery. */
export function serializeCaseQuery(query: CaseQuery, mode: CaseQueueMode): string {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set('q', query.search.trim());
  if (query.states?.length && !sameSet(query.states, defaultCaseStates(mode))) {
    params.set('state', query.states.join(','));
  }
  if (query.assignee && query.assignee !== 'any') params.set('assignee', query.assignee);
  if (query.sort && query.sort !== 'updated') params.set('sort', query.sort);
  if (query.direction && query.direction !== 'desc') params.set('dir', query.direction);
  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.pageSize && query.pageSize !== CASE_DEFAULT_PAGE_SIZE) {
    params.set('size', String(query.pageSize));
  }
  return params.toString();
}

/**
 * Apply a change and return the new href. Any change other than the page resets to page 1:
 * staying on page 7 of a result set that just shrank is the classic faceted-browser dead end.
 */
export function caseQueryHref(
  basePath: string,
  mode: CaseQueueMode,
  query: CaseQuery,
  patch: Partial<CaseQuery>,
): string {
  const resetsPage = Object.keys(patch).some((key) => key !== 'page');
  const next: CaseQuery = { ...query, ...patch, ...(resetsPage ? { page: 1 } : {}) };
  const serialized = serializeCaseQuery(next, mode);
  return serialized ? `${basePath}?${serialized}` : basePath;
}

/** True when the view differs from the queue's default — drives "Reset". */
export function hasActiveCaseFilters(query: CaseQuery, mode: CaseQueueMode): boolean {
  return Boolean(
    query.search?.trim() ||
    (query.assignee && query.assignee !== 'any') ||
    !sameSet(query.states ?? [], defaultCaseStates(mode)),
  );
}
