/**
 * URL <-> EntityQuery codec for the entity workbench.
 *
 * All workbench state lives in the query string so a filtered view can be bookmarked, shared in
 * a ticket, and survives refresh and back/forward. The previous catalog held search and
 * selection in useState, so none of that was true.
 *
 * Pure functions with no database or React dependency — this is the unit-tested seam.
 */
import {
  DEFAULT_PAGE_SIZE,
  LIVING_STATUSES,
  normalizePageSize,
  type EntityQuery,
  type EntitySortKey,
  type MergeStateFilter,
} from './entity-query.js';

export type QueryParamInput = Readonly<Record<string, string | readonly string[] | undefined>>;

const SORT_KEYS: readonly EntitySortKey[] = ['updated', 'created', 'name', 'kind', 'claims'];
const MERGE_STATES: readonly MergeStateFilter[] = ['active', 'absorbed', 'all'];

function readOne(input: QueryParamInput, key: string): string | undefined {
  const value = input[key];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Multi-value params accept both repeated keys (`?kind=person&kind=place`) and a comma-joined
 * form (`?kind=person,place`). The comma form is what we emit — it keeps shared URLs short.
 */
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

/** Parse a Next.js `searchParams` object into a validated EntityQuery. Unknown values fall back. */
export function parseEntityQuery(input: QueryParamInput): EntityQuery {
  const search = readOne(input, 'q')?.trim();
  const kinds = readMany(input, 'kind');
  const entityClasses = readMany(input, 'class');
  const livingStatuses = readMany(input, 'living').filter((value) =>
    (LIVING_STATUSES as readonly string[]).includes(value),
  );
  const sensitivityClasses = readMany(input, 'sensitivity');

  const sortRaw = readOne(input, 'sort');
  const sort = SORT_KEYS.includes(sortRaw as EntitySortKey) ? (sortRaw as EntitySortKey) : 'updated';

  const directionRaw = readOne(input, 'dir');
  // Names read naturally A→Z; recency and counts read naturally highest-first.
  const direction: 'asc' | 'desc' =
    directionRaw === 'asc' || directionRaw === 'desc'
      ? directionRaw
      : sort === 'name' || sort === 'kind'
        ? 'asc'
        : 'desc';

  const mergeRaw = readOne(input, 'merge');
  const mergeState = MERGE_STATES.includes(mergeRaw as MergeStateFilter)
    ? (mergeRaw as MergeStateFilter)
    : 'active';

  return {
    ...(search ? { search } : {}),
    ...(kinds.length ? { kinds } : {}),
    ...(entityClasses.length ? { entityClasses } : {}),
    ...(livingStatuses.length ? { livingStatuses } : {}),
    ...(sensitivityClasses.length ? { sensitivityClasses } : {}),
    ...(readOne(input, 'noclaims') === '1' ? { withoutClaims: true } : {}),
    mergeState,
    sort,
    direction,
    page: readPositiveInt(input, 'page') ?? 1,
    pageSize: normalizePageSize(readPositiveInt(input, 'size')),
  };
}

/**
 * Serialize back to a query string, omitting defaults so a clean view has a clean URL.
 * Round-trips with parseEntityQuery.
 */
export function serializeEntityQuery(query: EntityQuery): string {
  const params = new URLSearchParams();
  const setMany = (key: string, values: readonly string[] | undefined) => {
    if (values && values.length > 0) params.set(key, values.join(','));
  };

  if (query.search?.trim()) params.set('q', query.search.trim());
  setMany('kind', query.kinds);
  setMany('class', query.entityClasses);
  setMany('living', query.livingStatuses);
  setMany('sensitivity', query.sensitivityClasses);
  if (query.withoutClaims) params.set('noclaims', '1');
  if (query.mergeState && query.mergeState !== 'active') params.set('merge', query.mergeState);
  if (query.sort && query.sort !== 'updated') params.set('sort', query.sort);

  const defaultDirection = query.sort === 'name' || query.sort === 'kind' ? 'asc' : 'desc';
  if (query.direction && query.direction !== defaultDirection) params.set('dir', query.direction);
  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.pageSize && query.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set('size', String(query.pageSize));
  }

  return params.toString();
}

/**
 * Apply a change to a query and return the new href. Any filter or sort change resets to page 1
 * — staying on page 7 of a result set that just shrank to 2 pages is the classic faceted-browser
 * dead end.
 */
export function entityQueryHref(
  basePath: string,
  query: EntityQuery,
  patch: Partial<EntityQuery>,
): string {
  const resetsPage = Object.keys(patch).some((key) => key !== 'page');
  const next: EntityQuery = { ...query, ...patch, ...(resetsPage ? { page: 1 } : {}) };
  const serialized = serializeEntityQuery(next);
  return serialized ? `${basePath}?${serialized}` : basePath;
}

/** Toggle one value within a multi-select facet, returning the new href. */
export function toggleFacetHref(
  basePath: string,
  query: EntityQuery,
  key: 'kinds' | 'entityClasses' | 'livingStatuses' | 'sensitivityClasses',
  value: string,
): string {
  const current = query[key] ?? [];
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
  return entityQueryHref(basePath, query, { [key]: next } as Partial<EntityQuery>);
}

/** True when any filter narrows the set — drives whether a "Clear filters" affordance shows. */
export function hasActiveFilters(query: EntityQuery): boolean {
  return Boolean(
    query.search?.trim() ||
      query.kinds?.length ||
      query.entityClasses?.length ||
      query.livingStatuses?.length ||
      query.sensitivityClasses?.length ||
      query.withoutClaims ||
      (query.mergeState && query.mergeState !== 'active'),
  );
}
