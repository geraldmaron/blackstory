/**
 * Pure server-side view-model builder for the `/history` page. Parses URL search params,
 * loads the graph release artifact snapshot, resolves the active decade or all-time slice,
 * and shapes nodes/edges for the graph panel and synchronized list peer no Next.js runtime
 * dependency so it is directly unit-testable (see `./history-view-model.test.ts`).
 */
import { SEED_ENTITY_RELATIONSHIPS } from '../../data/entity-graph-seed';
import { getHistoryGraphReleaseArtifact } from '../../data/history-graph-seed';
import {
  buildHistoryEdges,
  buildHistoryGraphContext,
  buildHistoryNodes,
  resolveHistoryGraphSlice,
  type HistoryEdgeView,
  type HistoryNodeView,
} from './build-history-graph';
import type { HistoryFacetOption } from './filters';
import { parseHistorySearchParams, type HistoryViewState, type RawHistorySearchParams } from './url-state';

export type HistoryViewModel = {
  readonly viewState: HistoryViewState;
  readonly availableDecades: readonly string[];
  readonly activeDecade?: string;
  readonly sparseDecade: boolean;
  readonly nodes: readonly HistoryNodeView[];
  readonly edges: readonly HistoryEdgeView[];
  readonly facetOptions: { readonly kind: readonly HistoryFacetOption[] };
  readonly totalMatched: number;
  readonly releaseId: string;
  readonly contentHash: string;
  readonly selectedNode?: HistoryNodeView;
  readonly selectedEdge?: HistoryEdgeView;
};

export function buildHistoryViewModel(raw: RawHistorySearchParams): HistoryViewModel {
  const viewState = parseHistorySearchParams(raw);
  const artifact = getHistoryGraphReleaseArtifact();
  const context = buildHistoryGraphContext(artifact);
  const slice = resolveHistoryGraphSlice(artifact, viewState.mode, viewState.decade);

  const nodes = buildHistoryNodes(slice, viewState.filters, context.entitiesById);
  const visibleNodeIds = new Set(nodes.map((node) => node.entityId));
  const edges = buildHistoryEdges(slice, SEED_ENTITY_RELATIONSHIPS, context.entitiesById, visibleNodeIds);

  const selectedNode = viewState.selected
    ? nodes.find((node) => node.entityId === viewState.selected)
    : undefined;
  const selectedEdge = viewState.edge
    ? edges.find((edge) => edge.edgeId === viewState.edge)
    : undefined;

  return {
    viewState,
    availableDecades: context.availableDecades,
    ...(slice.activeDecade ? { activeDecade: slice.activeDecade } : {}),
    sparseDecade: slice.sparseDecade,
    nodes,
    edges,
    facetOptions: context.facetOptions,
    totalMatched: nodes.length,
    releaseId: context.releaseId,
    contentHash: context.contentHash,
    ...(selectedNode ? { selectedNode } : {}),
    ...(selectedEdge ? { selectedEdge } : {}),
  };
}
