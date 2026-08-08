/**
 * `bb_public.search_index` row → canonical public search projection.
 * The mapping lives in `@repo/schemas` (`search-index-row.ts`) so the ops release-artifact
 * publisher produces byte-identical docs; this module keeps the web-local import path.
 */
export {
  mapPostgresSearchIndexRow,
  type PublicSearchIndexRow as SearchIndexRow,
} from '@repo/schemas';
