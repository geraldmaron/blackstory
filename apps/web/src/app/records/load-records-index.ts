/**
 * Request-scoped Records index load.
 *
 * `generateMetadata` and the page both need the same `buildRecordsIndex` result. Without a
 * cache, one `/records` request built the full catalog index twice.
 *
 * Prefers the search_index slim when active-release docs carry projected `evidenceInputs`
 * (release-builder + `backfill-search-facets-evidence-inputs.ts`). The slim path caches the
 * grading INPUTS and applies the shared tier rule at read time, so it is not a second opinion
 * about a record's grade — see `build-records-index.ts`. Falls back to full entities so evidence
 * floors stay honest before the backfill lands.
 */
import { cache } from 'react';
import { loadDoorPinPlate } from '../../lib/map-experience/door-catalog';
import { loadRecordsCatalog } from '../../lib/records/records-catalog';
import { resolveStoryCollectionSource } from '../../lib/stories/source';
import {
  NO_COLLECTION,
  collectionDescriptorWithoutRead,
  resolveStoryCollection,
  storyCollectionSlug,
  type CollectionDescriptor,
} from '../../lib/discovery/story-collection';
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
  readonly catalogSource: 'search_index' | 'entities';
  /** Resolved named collection; `unknown` means the page should redirect to `collection=missing`. */
  readonly collection: CollectionDescriptor;
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
  const slug = storyCollectionSlug(query.collection);
  const [{ data, catalogSource }, { features }, storySource] = await Promise.all([
    loadRecordsCatalog(),
    loadDoorPinPlate(),
    // Only a well-formed `story:<slug>` reads the story cache; sentinels need no read.
    slug === undefined ? Promise.resolve(undefined) : resolveStoryCollectionSource(slug),
  ]);
  const drawableIds = new Set(features.map((feature) => feature.properties.entityId));
  // Membership resolves over the released bibliography only: linked ids that are not in this
  // catalog are counted by the descriptor, never listed.
  const collection: CollectionDescriptor =
    storySource !== undefined
      ? resolveStoryCollection(
          storySource,
          new Set((data as readonly { readonly id: string }[]).map((entry) => entry.id)),
        )
      : (collectionDescriptorWithoutRead(query.collection) ?? NO_COLLECTION);
  return {
    query,
    model: buildRecordsIndex(data, query, drawableIds, collection),
    catalogSource,
    collection,
  };
});
