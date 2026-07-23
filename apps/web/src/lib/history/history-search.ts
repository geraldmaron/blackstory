/**
 * Keyword search for `/history` using the public search index pipeline
 * (`runPublicSearch`). Server-only: import from view-model builders, never from
 * client components. Uses `@repo/domain/search` subpath to avoid the domain barrel
 * (which pulls publication/node:crypto into Webpack client graphs).
 */
import { runPublicSearch, type PublicSearchIndexDoc } from '@repo/domain/search';
import { getSnapshotSearchIndex } from '../search/snapshot-search-index';
import type { HistoryNodeView } from './build-history-graph';

/** NFKC normalize + control-char strip; mirrors `@repo/security` search normalization without that barrel. */
function normalizeHistoryQuery(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u2029\ufeff]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function rankHistorySearchEntityIds(
  entityIds: readonly string[],
  q: string,
  searchIndex: readonly PublicSearchIndexDoc[] = getSnapshotSearchIndex(),
): readonly string[] {
  const needle = normalizeHistoryQuery(q);
  if (!needle || entityIds.length === 0) return [];

  const allowed = new Set(entityIds);
  const scopedIndex = searchIndex.filter((doc) => allowed.has(doc.id));
  if (scopedIndex.length === 0) return [];

  const execution = runPublicSearch(
    {
      normalizedQuery: needle,
      filters: [],
      sort: 'relevance',
      offset: 0,
      pageSize: scopedIndex.length,
    },
    scopedIndex,
  );

  return execution.results.map((result) => result.id);
}

export function applyHistorySearchFilter(
  nodes: readonly HistoryNodeView[],
  q: string,
  searchIndex: readonly PublicSearchIndexDoc[] = getSnapshotSearchIndex(),
): readonly HistoryNodeView[] {
  const rankedIds = rankHistorySearchEntityIds(
    nodes.map((node) => node.entityId),
    q,
    searchIndex,
  );
  if (rankedIds.length === 0) return [];

  const byId = new Map(nodes.map((node) => [node.entityId, node]));
  return rankedIds
    .map((entityId) => byId.get(entityId))
    .filter((node): node is HistoryNodeView => node !== undefined);
}
