/**
 * Pure server-side view-model builder for the `/history` page. Parses URL search params,
 * loads the graph release artifact snapshot, resolves the active decade or all-time slice,
 * and shapes nodes/edges for the graph panel and synchronized list peer. Entity catalog is
 * injected so callers can pass the live public pool (same as explore/search) while tests keep
 * using the seed snapshot. No Next.js runtime dependency so it is directly unit-testable.
 */
import { SEED_ENTITY_RELATIONSHIPS } from '../../data/entity-graph-seed';
import { getHistoryGraphReleaseArtifact } from '../../data/history-graph-seed';
import { listPublicEntities, type PublicEntityView } from '../../data/public-seed';
import {
  buildHistoryEdges,
  buildHistoryGraphContext,
  buildHistoryNodes,
  resolveHistoryGraphSlice,
  withHistoryConnectionCounts,
  type HistoryEdgeView,
  type HistoryNodeView,
} from './build-history-graph';
import {
  applyHistoryConnectionsFilter,
  applyHistoryQueryFilter,
  applyHistoryStatusFilter,
  applyHistoryTopicFilter,
  buildHistoryKindFacetOptionsWithCounts,
  buildHistoryStatusFacetOptions,
  buildHistoryTopicFacetOptions,
  sortHistoryNodes,
  trimHistoryEdgesToNodes,
  type HistoryFacetOption,
  type HistoryFilterState,
} from './filters';
import { buildHistoryOverview, type HistoryOverview } from './overview';
import {
  parseHistorySearchParams,
  type HistoryViewState,
  type RawHistorySearchParams,
} from './url-state';

export type HistoryViewModel = {
  readonly viewState: HistoryViewState;
  readonly availableDecades: readonly string[];
  readonly activeDecade?: string;
  readonly sparseDecade: boolean;
  readonly nodes: readonly HistoryNodeView[];
  readonly edges: readonly HistoryEdgeView[];
  readonly facetOptions: {
    readonly kind: readonly HistoryFacetOption[];
    readonly status: readonly HistoryFacetOption[];
    readonly topic: readonly HistoryFacetOption[];
  };
  readonly overview: HistoryOverview;
  readonly totalMatched: number;
  readonly releaseId: string;
  readonly contentHash: string;
  readonly selectedNode?: HistoryNodeView;
  readonly selectedEdge?: HistoryEdgeView;
};

function buildSliceNodesWithCounts(
  slice: ReturnType<typeof resolveHistoryGraphSlice>,
  filters: HistoryFilterState,
  entitiesById: ReadonlyMap<string, PublicEntityView>,
): readonly HistoryNodeView[] {
  const nodes = buildHistoryNodes(slice, filters, entitiesById);
  const nodeIds = new Set(nodes.map((node) => node.entityId));
  const edges = buildHistoryEdges(slice, SEED_ENTITY_RELATIONSHIPS, entitiesById, nodeIds);
  return withHistoryConnectionCounts(nodes, edges);
}

export function buildHistoryViewModel(
  raw: RawHistorySearchParams,
  entities: readonly PublicEntityView[] = listPublicEntities(),
): HistoryViewModel {
  const viewState = parseHistorySearchParams(raw);
  const artifact = getHistoryGraphReleaseArtifact(entities);
  const context = buildHistoryGraphContext(artifact, entities);
  const slice = resolveHistoryGraphSlice(artifact, viewState.mode, viewState.decade);

  const kindFiltered = buildSliceNodesWithCounts(slice, viewState.filters, context.entitiesById);
  const visibleNodeIds = new Set(kindFiltered.map((node) => node.entityId));
  const edges = buildHistoryEdges(
    slice,
    SEED_ENTITY_RELATIONSHIPS,
    context.entitiesById,
    visibleNodeIds,
  );

  const sliceForKindFacets = buildSliceNodesWithCounts(
    slice,
    { ...viewState.filters, kind: 'all' },
    context.entitiesById,
  );

  const facetOptions = {
    kind: buildHistoryKindFacetOptionsWithCounts(sliceForKindFacets),
    status: buildHistoryStatusFacetOptions(kindFiltered),
    topic: buildHistoryTopicFacetOptions(kindFiltered),
  };

  let filtered = kindFiltered;
  filtered = applyHistoryStatusFilter(filtered, viewState.filters.status);
  filtered = applyHistoryTopicFilter(filtered, viewState.filters.topic);
  filtered = applyHistoryConnectionsFilter(filtered, viewState.filters.connections);
  filtered = applyHistoryQueryFilter(filtered, viewState.filters.q);
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
    releaseId: context.releaseId,
    contentHash: context.contentHash,
    ...(selectedNode ? { selectedNode } : {}),
    ...(selectedEdge ? { selectedEdge } : {}),
  };
}
