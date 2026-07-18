/**
 * Pure server-side view-model builder for the `/explore` page. Parses URL search params,
 * builds the explore map source from the active release snapshot, applies filters, and shapes
 * facet options no Next.js runtime dependency so it is directly unit-testable (see
 * `./explore-view-model.test.ts`). Precomputes History edge line catalogs so the client can
 * toggle lines/decade without importing the graph release builder.
 */
import { SEED_ENTITY_RELATIONSHIPS } from '../../../data/entity-graph-seed';
import { getHistoryGraphReleaseArtifact } from '../../../data/history-graph-seed';
import { listPublicEntities, type PublicEntityView } from '../../../data/public-seed';
import {
  buildHistoryEdges,
  buildHistoryGraphContext,
  resolveHistoryGraphSlice,
  type HistoryEdgeView,
} from '../../../lib/history/build-history-graph';
import {
  applyExploreFilters,
  buildExploreFacetOptions,
  buildExploreMapSource,
  buildHistoryEdgeLineCollection,
  buildStateDensityLevels,
  parseExploreSearchParams,
  type ExploreFacetOptions,
  type ExploreMapFeature,
  type ExploreMapSource,
  type ExploreViewState,
  type RawExploreSearchParams,
} from '../../../lib/map-experience';
import type { PublicReadSource } from '../../../lib/public-data/source';
import {
  pickExploreEdgeSlice,
  type ExploreEdgeLineCatalog,
  type ExploreEdgeLineSlice,
} from './explore-edge-catalog';

export type { ExploreEdgeLineCatalog, ExploreEdgeLineSlice } from './explore-edge-catalog';
export { pickExploreEdgeSlice } from './explore-edge-catalog';

export type ExploreViewModel = {
  readonly viewState: ExploreViewState;
  readonly source: ExploreMapSource;
  readonly allFeatures: readonly ExploreMapFeature[];
  readonly filteredFeatures: readonly ExploreMapFeature[];
  readonly densityLevels: ReturnType<typeof buildStateDensityLevels>;
  readonly facetOptions: ExploreFacetOptions;
  readonly totalMatched: number;
  readonly dataSource: PublicReadSource;
  readonly availableDecades: readonly string[];
  /** All-time + per-decade edge/line catalogs for client toggles without graph rebuild.  */
  readonly edgeLineCatalog: ExploreEdgeLineCatalog;
  readonly historyEdges: readonly HistoryEdgeView[];
  readonly edgeLineCollection: ExploreEdgeLineSlice['lineCollection'];
  readonly selectedEdge?: HistoryEdgeView;
};

function buildEdgeSlice(
  artifact: ReturnType<typeof getHistoryGraphReleaseArtifact>,
  entitiesById: ReturnType<typeof buildHistoryGraphContext>['entitiesById'],
  mode: 'all-time' | 'decade',
  decade?: string,
): ExploreEdgeLineSlice {
  const slice = resolveHistoryGraphSlice(artifact, mode, decade);
  const edges = buildHistoryEdges(
    slice,
    SEED_ENTITY_RELATIONSHIPS,
    entitiesById,
    new Set(slice.nodeIds),
  );
  return {
    edges,
    lineCollection: buildHistoryEdgeLineCollection(edges),
  };
}

export function buildExploreViewModel(
  raw: RawExploreSearchParams,
  entities: readonly PublicEntityView[] = listPublicEntities(),
  dataSource: PublicReadSource = 'snapshot',
): ExploreViewModel {
  const viewState = parseExploreSearchParams(raw);
  const source = buildExploreMapSource(entities);
  const allFeatures = source.featureCollection.features;
  const filteredFeatures = applyExploreFilters(allFeatures, viewState.filters, viewState.state);
  const densityLevels = buildStateDensityLevels(source.stateAggregates);

  const artifact = getHistoryGraphReleaseArtifact();
  const historyContext = buildHistoryGraphContext(artifact);
  const allTime = buildEdgeSlice(artifact, historyContext.entitiesById, 'all-time');
  const byDecade: Record<string, ExploreEdgeLineSlice> = {};
  for (const decade of historyContext.availableDecades) {
    byDecade[decade] = buildEdgeSlice(artifact, historyContext.entitiesById, 'decade', decade);
  }
  const edgeLineCatalog = { allTime, byDecade };
  const active = pickExploreEdgeSlice(edgeLineCatalog, viewState);
  const selectedEdge = viewState.edge
    ? active.edges.find((edge) => edge.edgeId === viewState.edge)
    : undefined;

  return {
    viewState,
    source,
    allFeatures,
    filteredFeatures,
    densityLevels,
    facetOptions: buildExploreFacetOptions(allFeatures),
    totalMatched: filteredFeatures.length,
    dataSource,
    availableDecades: historyContext.availableDecades,
    edgeLineCatalog,
    historyEdges: active.edges,
    edgeLineCollection: active.lineCollection,
    ...(selectedEdge ? { selectedEdge } : {}),
  };
}
