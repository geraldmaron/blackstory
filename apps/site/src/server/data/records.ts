/**
 * The /records data read: parse the query, read the release-scoped search index through the cache,
 * build the page model. Port of apps/web/src/app/records/load-records-index.ts without `cache()`:
 * the generateMetadata call and the loader call both land on the process cache, so the index is built
 * from one catalog read either way.
 */
import { CatalogUnavailableError, type Catalog } from './catalog';
import {
  buildRecordsIndex,
  parseRecordsQuery,
  searchIndexReadyForRecords,
  type RecordsIndex,
  type RecordsQuery,
} from './sources';

export type RecordsPageData = {
  readonly query: RecordsQuery;
  readonly model: RecordsIndex;
  readonly releaseId: string;
};

export async function loadRecordsPage(
  searchParams: URLSearchParams,
  source: Pick<Catalog, 'getSearchIndex'>,
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
  // Evidence honesty: grades come from the inputs on each doc. The Next loader falls back to hydrating
  // full entities when too few docs carry them; that fallback is not ported (repo-6obbo follow-up), so
  // an index without coverage is refused rather than shown with records silently ungraded.
  if (!ready(docs)) {
    throw new CatalogUnavailableError(
      `search index for ${release.releaseId} lacks evidence inputs`,
    );
  }
  return { query, model: buildRecordsIndex(docs, query), releaseId: release.releaseId };
}
