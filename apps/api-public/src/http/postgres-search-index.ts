/**
 * `bb_public.search_index` row → canonical public search projection.
 * The mapping lives in `@repo/schemas` (`search-index-row.ts`) so this surface, `apps/web`,
 * and the ops release-artifact publisher all produce identical docs from the same rows.
 */
export {
  mapPostgresSearchIndexRow,
  type PublicSearchIndexRow as SearchIndexRow,
} from '@repo/schemas';
