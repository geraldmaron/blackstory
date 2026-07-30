/**
 * Pure server-side view-model builder for the `/history` page. Parses URL search params,
 * loads the graph release artifact snapshot, resolves the active decade or all-time slice,
 * and shapes nodes/edges for the graph panel and synchronized list peer. Entity catalog is
 * injected so callers can pass the live public pool (same as explore/search) while tests keep
 * using the seed snapshot. No Next.js runtime dependency so it is directly unit-testable.
 */
import { getHistoryGraphReleaseArtifact, resolveHistoryGraphReleaseArtifact } from '../../data/history-graph-seed';
import { listPublicEntities, type PublicEntityView } from '../../data/public-seed';
import type { EntityRelationship } from '@repo/domain';
import {
  buildHistoryEdges,
  buildHistoryGraphContext,
  buildHistoryNodes,
  resolveHistoryGraphSlice,
  withHistoryConnectionCounts,
  type HistoryNodeView,
} from './build-history-graph';
import {
  applyHistoryConnectionsFilter,
  applyHistoryEraFilter,
  applyHistoryStatusFilter,
  applyHistoryTopicFilter,
  buildHistoryEraFacetOptions,
  buildHistoryKindCategoryFacetOptions,
  buildHistoryKindFacetOptionsWithCounts,
  buildHistoryStatusFacetOptions,
  buildHistoryTopicFacetOptions,
  sortHistoryNodes,
  trimHistoryEdgesToNodes,
  type HistoryFilterState,
} from './filters';
import { applyHistorySearchFilter } from './history-search';
import { buildSearchIndexForEntities } from '../search/snapshot-search-index';
import { buildHistoryOverview } from './overview';
import {
  parseHistorySearchParams,
  type RawHistorySearchParams,
} from './url-state';
import type { HistoryViewModel } from './history-view-model.types';

export type { HistoryViewModel } from './history-view-model.types';

function buildSliceNodesWithCounts(
  slice: ReturnType<typeof resolveHistoryGraphSlice>,
  filters: HistoryFilterState,
  entitiesById: ReadonlyMap<string, PublicEntityView>,
  relationships: readonly EntityRelationship[],
): readonly HistoryNodeView[] {
  const nodes = buildHistoryNodes(slice, filters, entitiesById);
  const nodeIds = new Set(nodes.map((node) => node.entityId));
  const edges = buildHistoryEdges(slice, relationships, entitiesById, nodeIds);
  return withHistoryConnectionCounts(nodes, edges);
}

export type BuildHistoryViewModelOptions = {
  /** Active public release id when live projections are wired; defaults to seed snapshot. */
  readonly releaseId?: string;
  /** Pre-resolved graph artifact (stored release_graph_* or in-process fallback). */
  readonly graphArtifact?: import('@repo/domain').GraphReleaseArtifact;
};

export function buildHistoryViewModel(
  raw: RawHistorySearchParams,
  entities: readonly PublicEntityView[] = listPublicEntities(),
  options: BuildHistoryViewModelOptions = {},
): HistoryViewModel {
  const viewState = parseHistorySearchParams(raw);
  const artifact =
    options.graphArtifact ??
    getHistoryGraphReleaseArtifact(entities, {
      ...(options.releaseId ? { releaseId: options.releaseId } : {}),
    });
  const context = buildHistoryGraphContext(artifact, entities);

  // A text query searches the FULL dataset, not just the active decade (repo-k1t9). Without
  // this, resolving the decade slice first silently scoped search to that decade — e.g.
  // searching "obama" while parked on any decade other than the 2000s returned nothing. When
  // a query is present we resolve the all-time slice for matching and flag the scope-break so
  // the UI can say results span every decade.
  const hasQuery = viewState.filters.q.trim().length > 0;
  const searchSpansAllTime = hasQuery && viewState.mode === 'decade';
  const slice = searchSpansAllTime
    ? resolveHistoryGraphSlice(artifact, 'all-time', undefined)
    : resolveHistoryGraphSlice(artifact, viewState.mode, viewState.decade);

  const kindFiltered = buildSliceNodesWithCounts(
    slice,
    viewState.filters,
    context.entitiesById,
    context.relationships,
  );
  const visibleNodeIds = new Set(kindFiltered.map((node) => node.entityId));
  const edges = buildHistoryEdges(
    slice,
    context.relationships,
    context.entitiesById,
    visibleNodeIds,
  );

  const sliceForKindFacets = buildSliceNodesWithCounts(
    slice,
    { ...viewState.filters, kind: 'all' },
    context.entitiesById,
    context.relationships,
  );

  const facetOptions = {
    kind: buildHistoryKindCategoryFacetOptions(sliceForKindFacets),
    kindDetail: buildHistoryKindFacetOptionsWithCounts(sliceForKindFacets),
    status: buildHistoryStatusFacetOptions(kindFiltered),
    era: buildHistoryEraFacetOptions(kindFiltered),
    topic: buildHistoryTopicFacetOptions(kindFiltered),
  };

  let filtered = kindFiltered;
  filtered = applyHistoryStatusFilter(filtered, viewState.filters.status);
  filtered = applyHistoryEraFilter(filtered, viewState.filters.era);
  filtered = applyHistoryTopicFilter(filtered, viewState.filters.topic);
  filtered = applyHistoryConnectionsFilter(filtered, viewState.filters.connections);
  if (hasQuery) {
    // Search the same live catalog that is on screen, not the bundled seed snapshot index
    // (repo-k1t9): otherwise the full release renders 1000+ records while search only queried
    // the ~13 seed docs, so real records like the 2009 Obama inauguration returned nothing.
    const searchIndex = buildSearchIndexForEntities(entities, artifact.releaseId);
    filtered = applyHistorySearchFilter(filtered, viewState.filters.q, searchIndex);
  }
  const nodes = sortHistoryNodes(filtered, viewState.filters.sort);

  const matchedIds = new Set(nodes.map((node) => node.entityId));
  const visibleEdges = trimHistoryEdgesToNodes(edges, matchedIds);

  const selectedNode = viewState.selected
    ? nodes.find((node) => node.entityId === viewState.selected)
    : undefined;
  const selectedEdge = viewState.edge
    ? visibleEdges.find((edge) => edge.edgeId === viewState.edge)
    : undefined;

  const overview = buildHistoryOverview(nodes, visibleEdges, artifact);

  return {
    viewState,
    availableDecades: context.availableDecades,
    ...(slice.activeDecade ? { activeDecade: slice.activeDecade } : {}),
    sparseDecade: slice.sparseDecade,
    nodes,
    edges: visibleEdges,
    facetOptions,
    overview,
    totalMatched: nodes.length,
    searchSpansAllTime,
    releaseId: context.releaseId,
    contentHash: context.contentHash,
    ...(selectedNode ? { selectedNode } : {}),
    ...(selectedEdge ? { selectedEdge } : {}),
  };
}

export async function buildHistoryViewModelAsync(
  raw: RawHistorySearchParams,
  entities: readonly PublicEntityView[] = listPublicEntities(),
  options: BuildHistoryViewModelOptions = {},
): Promise<HistoryViewModel> {
  const artifact =
    options.graphArtifact ??
    (await resolveHistoryGraphReleaseArtifact(entities, {
      ...(options.releaseId ? { releaseId: options.releaseId } : {}),
    }));
  return buildHistoryViewModel(raw, entities, { ...options, graphArtifact: artifact });
}
