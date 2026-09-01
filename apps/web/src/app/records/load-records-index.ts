/**
 * Request-scoped Records index load.
 *
 * `generateMetadata` and the page both need the same `buildRecordsIndex` result. Without a
 * cache, one `/records` request built the full catalog index twice. Entities still come from
 * `getSharedPublicEntities` (React.cache); this layer dedupes the CPU-heavy index build.
 *
 * Full search_index slim is deferred until active-release facets carry `confidenceTier`
 * (projected by release-builder; backfill via `backfill-search-facets-confidence.ts`).
 */
import { cache } from 'react';
import { getSharedPublicEntities } from '../../lib/map-experience/shared-map-data';
import {
  buildRecordsIndex,
  parseRecordsQuery,
  recordsHref,
  type RecordsIndex,
  type RecordsQuery,
} from '../../lib/records/build-records-index';

export type RecordsPageModel = {
  readonly query: RecordsQuery;
  readonly model: RecordsIndex;
};

/** Stable key so metadata and page share one index build per request. */
export function recordsQueryCacheKey(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  return recordsHref(parseRecordsQuery(searchParams));
}

export function loadRecordsIndexFromKey(queryKey: string): {
  readonly query: RecordsQuery;
} {
  const qs = queryKey.includes('?') ? queryKey.slice(queryKey.indexOf('?') + 1) : '';
  return { query: parseRecordsQuery(Object.fromEntries(new URLSearchParams(qs))) };
}

export const loadRecordsIndex = cache(async function loadRecordsIndex(
  queryKey: string,
): Promise<RecordsPageModel> {
  const { query } = loadRecordsIndexFromKey(queryKey);
  const { data: entities } = await getSharedPublicEntities();
  return { query, model: buildRecordsIndex(entities, query) };
});
