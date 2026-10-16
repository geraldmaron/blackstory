/**
 * The /records data read: parse the query, read the release-scoped search index through the cache,
 * build the page model. Port of apps/web/src/app/records/load-records-index.ts without `cache()`:
 * the generateMetadata call and the loader call both land on the process cache, so the index is built
 * from one catalog read either way.
 */
import type { Catalog } from './catalog';
import type { EntityCatalog } from './entities';
import {
  buildRecordsIndex,
  parseRecordsQuery,
  searchIndexReadyForRecords,
  type RecordsIndex,
  type PublicEntityView,
  type RecordsQuery,
} from './sources';

export type RecordsPageData = {
  readonly query: RecordsQuery;
  readonly model: RecordsIndex;
  readonly releaseId: string;
  /** Which read the model was built from: the slim search index, or full entities when it lacked evidence inputs. */
  readonly catalogSource: 'search_index' | 'entities';
};

export async function loadRecordsPage(
  searchParams: URLSearchParams,
  source: Pick<Catalog, 'getSearchIndex'>,
  entitySource: Pick<EntityCatalog<PublicEntityView>, 'getEntities'>,
  ready: (
    docs: Awaited<ReturnType<Catalog['getSearchIndex']>>['docs'],
  ) => boolean = searchIndexReadyForRecords,
): Promise<RecordsPageData> {
  const raw: Record<string, string | string[]> = {};
  for (const key of new Set(searchParams.keys())) {
    const all = searchParams.getAll(key);
    raw[key] = all.length > 1 ? all : (all[0] ?? '');
  }
  const query = parseRecordsQuery(raw);
  const { docs, release } = await source.getSearchIndex();
  // The slim index carries the grading INPUTS; the shared tier rule is applied at read time. Below the
  // coverage floor (a release the backfill has not reached) the grades would be wrong, so the index is
  // built from full entities instead, exactly as the Next loader does.
  if (ready(docs)) {
    return {
      query,
      model: buildRecordsIndex(docs, query),
      releaseId: release.releaseId,
      catalogSource: 'search_index',
    };
  }
  const { data } = await entitySource.getEntities(release);
  return {
    query,
    model: buildRecordsIndex(data, query),
    releaseId: release.releaseId,
    catalogSource: 'entities',
  };
}
