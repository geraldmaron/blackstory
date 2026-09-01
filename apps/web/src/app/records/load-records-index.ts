/**
 * Request-scoped Records index load.
 *
 * `generateMetadata` and the page both need the same `buildRecordsIndex` result. Without a
 * cache, one `/records` request built the full catalog index twice.
 *
 * Prefers the search_index slim when active-release docs carry projected `confidenceTier`
 * (release-builder + `backfill-search-facets-confidence.ts`). Falls back to full entities so
 * evidence floors stay honest before the backfill lands.
 */
import { cache } from 'react';
import { getSharedPublicEntities } from '../../lib/map-experience/shared-map-data';
import { getPublicSearchIndex } from '../../lib/public-data/source';
import {
  buildRecordsIndex,
  parseRecordsQuery,
  recordsHref,
  searchIndexReadyForRecords,
  type RecordsIndex,
  type RecordsQuery,
} from '../../lib/records/build-records-index';

export type RecordsPageModel = {
  readonly query: RecordsQuery;
  readonly model: RecordsIndex;
  readonly catalogSource: 'search_index' | 'entities';
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
  const { data: searchDocs } = await getPublicSearchIndex();
  if (searchIndexReadyForRecords(searchDocs)) {
    return {
      query,
      model: buildRecordsIndex(searchDocs, query),
      catalogSource: 'search_index',
    };
  }
  const { data: entities } = await getSharedPublicEntities();
  return {
    query,
    model: buildRecordsIndex(entities, query),
    catalogSource: 'entities',
  };
});
