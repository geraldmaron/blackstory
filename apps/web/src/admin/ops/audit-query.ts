/**
 * Audit-log query vocabulary and URL codec. Free of `pg` so the client table can import the types.
 */
import {
  DESK_DEFAULT_PAGE_SIZE,
  normalizeDeskPageSize,
  readIsoDay,
  readMany,
  readOne,
  readPositiveInt,
  toggleValue,
  type QueryParamInput,
} from '../lib/desk-query';

export type AuditQuery = {
  readonly search?: string;
  readonly categories?: readonly string[];
  readonly actorTypes?: readonly string[];
  /** Inclusive calendar days, `YYYY-MM-DD`, in UTC. */
  readonly from?: string;
  readonly to?: string;
  readonly direction?: 'asc' | 'desc';
  readonly page?: number;
  readonly pageSize?: number;
};

export function parseAuditQuery(input: QueryParamInput): AuditQuery {
  const search = readOne(input, 'q')?.trim();
  const categories = readMany(input, 'category');
  const actorTypes = readMany(input, 'actor');
  const from = readIsoDay(input, 'from');
  const to = readIsoDay(input, 'to');
  return {
    ...(search ? { search } : {}),
    ...(categories.length ? { categories } : {}),
    ...(actorTypes.length ? { actorTypes } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    direction: readOne(input, 'dir') === 'asc' ? 'asc' : 'desc',
    page: readPositiveInt(input, 'page') ?? 1,
    pageSize: normalizeDeskPageSize(readPositiveInt(input, 'size')),
  };
}

export function serializeAuditQuery(query: AuditQuery): string {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set('q', query.search.trim());
  if (query.categories?.length) params.set('category', query.categories.join(','));
  if (query.actorTypes?.length) params.set('actor', query.actorTypes.join(','));
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.direction === 'asc') params.set('dir', 'asc');
  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.pageSize && query.pageSize !== DESK_DEFAULT_PAGE_SIZE) {
    params.set('size', String(query.pageSize));
  }
  return params.toString();
}

/** Any change other than the page resets to page 1; see `submissionQueryHref` for the reasoning. */
export function auditQueryHref(
  basePath: string,
  query: AuditQuery,
  patch: Partial<AuditQuery>,
): string {
  const resetsPage = Object.keys(patch).some((key) => key !== 'page');
  const serialized = serializeAuditQuery({
    ...query,
    ...patch,
    ...(resetsPage ? { page: 1 } : {}),
  });
  return serialized ? `${basePath}?${serialized}` : basePath;
}

export function toggleAuditFacetHref(
  basePath: string,
  query: AuditQuery,
  key: 'categories' | 'actorTypes',
  value: string,
): string {
  return auditQueryHref(basePath, query, { [key]: toggleValue(query[key], value) });
}

export function hasActiveAuditFilters(query: AuditQuery): boolean {
  return Boolean(
    query.search?.trim() ||
    query.categories?.length ||
    query.actorTypes?.length ||
    query.from ||
    query.to,
  );
}
