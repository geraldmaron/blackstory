/**
 * Graylist query vocabulary and URL codec. Free of `pg` so the client table can import the types.
 */
import {
  DESK_DEFAULT_PAGE_SIZE,
  normalizeDeskPageSize,
  readMany,
  readOne,
  readPositiveInt,
  toggleValue,
  type QueryParamInput,
} from '../lib/desk-query';

export const GRAYLIST_SORT_KEYS = ['parked', 'score', 'updated'] as const;
export type GraylistSortKey = (typeof GRAYLIST_SORT_KEYS)[number];

export type GraylistQuery = {
  readonly search?: string;
  readonly statuses?: readonly string[];
  readonly dispositions?: readonly string[];
  readonly sort?: GraylistSortKey;
  readonly direction?: 'asc' | 'desc';
  readonly page?: number;
  readonly pageSize?: number;
};

/** The queue an operator lands on: candidates still parked. Promoted and archived are one click away. */
export const DEFAULT_GRAYLIST_STATUSES: readonly string[] = ['parked'];

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

export function parseGraylistQuery(input: QueryParamInput): GraylistQuery {
  const search = readOne(input, 'q')?.trim();
  const statuses = readMany(input, 'status');
  const dispositions = readMany(input, 'disposition');
  const sortRaw = readOne(input, 'sort') as GraylistSortKey | undefined;
  return {
    ...(search ? { search } : {}),
    statuses: statuses.length ? statuses : DEFAULT_GRAYLIST_STATUSES,
    ...(dispositions.length ? { dispositions } : {}),
    sort: sortRaw && GRAYLIST_SORT_KEYS.includes(sortRaw) ? sortRaw : 'parked',
    direction: readOne(input, 'dir') === 'asc' ? 'asc' : 'desc',
    page: readPositiveInt(input, 'page') ?? 1,
    pageSize: normalizeDeskPageSize(readPositiveInt(input, 'size')),
  };
}

export function serializeGraylistQuery(query: GraylistQuery): string {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set('q', query.search.trim());
  if (query.statuses?.length && !sameSet(query.statuses, DEFAULT_GRAYLIST_STATUSES)) {
    params.set('status', query.statuses.join(','));
  }
  if (query.dispositions?.length) params.set('disposition', query.dispositions.join(','));
  if (query.sort && query.sort !== 'parked') params.set('sort', query.sort);
  if (query.direction === 'asc') params.set('dir', 'asc');
  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.pageSize && query.pageSize !== DESK_DEFAULT_PAGE_SIZE) {
    params.set('size', String(query.pageSize));
  }
  return params.toString();
}

export function graylistQueryHref(
  basePath: string,
  query: GraylistQuery,
  patch: Partial<GraylistQuery>,
): string {
  const resetsPage = Object.keys(patch).some((key) => key !== 'page');
  const serialized = serializeGraylistQuery({
    ...query,
    ...patch,
    ...(resetsPage ? { page: 1 } : {}),
  });
  return serialized ? `${basePath}?${serialized}` : basePath;
}

export function toggleGraylistFacetHref(
  basePath: string,
  query: GraylistQuery,
  key: 'statuses' | 'dispositions',
  value: string,
): string {
  return graylistQueryHref(basePath, query, { [key]: toggleValue(query[key], value) });
}

export function hasActiveGraylistFilters(query: GraylistQuery): boolean {
  return Boolean(
    query.search?.trim() ||
    query.dispositions?.length ||
    !sameSet(query.statuses ?? [], DEFAULT_GRAYLIST_STATUSES),
  );
}
