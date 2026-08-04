/**
 * Pure server-side view-model builder for the `/explore` page. Parses URL search params,
 * builds the explore map source from the active release snapshot, applies filters, and shapes
 * facet options no Next.js runtime dependency so it is directly unit-testable (see
 * `./explore-view-model.test.ts`). Precomputes History edge line catalogs so the client can
 * toggle lines/decade without importing the graph release builder.
 */
import {
  getHistoryGraphReleaseArtifact,
  resolveHistoryGraphReleaseArtifact,
} from '../../data/history-graph-seed';
import { listPublicEntities, type PublicEntityView } from '../../data/public-seed';
import {
  buildHistoryEdges,
  buildHistoryGraphContext,
  resolveHistoryGraphSlice,
  type HistoryEdgeView,
} from '../../lib/history/build-history-graph';
import {
  applyExploreFilters,
  buildEntityDecadeCounts,
  buildExploreFacetOptions,
  buildHistoryEdgeLineCollection,
  buildStateDensityLevels,
  parseExploreSearchParams,
  type EntityDecadeCount,
  type EntityGeoAnchor,
  type ExploreFacetOptions,
  type ExploreViewState,
  type RawExploreSearchParams,
} from '../../lib/map-experience';
import {
  buildExploreMapSource,
  type ExploreMapFeature,
  type ExploreMapSource,
} from '../../lib/map-experience/build-explore-map-source';
import type { PublicReadSource } from '../../lib/public-data/source';
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
  /** Chronological decade buckets with record counts — drives the decade rail. */
  readonly entityDecades: readonly EntityDecadeCount[];
  /** All-time + per-decade edge/line catalogs for client toggles without graph rebuild.  */
  readonly edgeLineCatalog: ExploreEdgeLineCatalog;
  readonly historyEdges: readonly HistoryEdgeView[];
  readonly edgeLineCollection: ExploreEdgeLineSlice['lineCollection'];
  readonly selectedEdge?: HistoryEdgeView;
};

/** Prefer each entity's published geoAnchor (national catalog). Seed-table fallback
 * lives inside `buildHistoryEdgeLineCollection` when this resolver returns undefined. */
function liveGeoAnchorResolver(
  entities: readonly PublicEntityView[],
): (entityId: string) => EntityGeoAnchor | undefined {
  const byId = new Map(entities.map((entity) => [entity.id, entity] as const));
  return (entityId) => byId.get(entityId)?.geoAnchor;
}

function buildEdgeSlice(
  artifact: ReturnType<typeof getHistoryGraphReleaseArtifact>,
  entitiesById: ReturnType<typeof buildHistoryGraphContext>['entitiesById'],
  relationships: ReturnType<typeof buildHistoryGraphContext>['relationships'],
  mode: 'all-time' | 'decade',
  resolveLiveGeoAnchor: (entityId: string) => EntityGeoAnchor | undefined,
  decade?: string,
): ExploreEdgeLineSlice {
  const slice = resolveHistoryGraphSlice(artifact, mode, decade);
  const edges = buildHistoryEdges(slice, relationships, entitiesById, new Set(slice.nodeIds));
  return {
    edges,
    lineCollection: buildHistoryEdgeLineCollection(edges, {
      geoAnchorFor: resolveLiveGeoAnchor,
    }),
  };
}

/** All-time + per-decade edge/line catalog over the history graph release —
 * shared by the explore view model and the home hero's decades-in-motion flow. */
export function buildEdgeLineCatalog(
  artifact: ReturnType<typeof getHistoryGraphReleaseArtifact> = getHistoryGraphReleaseArtifact(),
  entities: readonly PublicEntityView[] = listPublicEntities(),
): {
  readonly edgeLineCatalog: ExploreEdgeLineCatalog;
  readonly availableDecades: readonly string[];
} {
  const historyContext = buildHistoryGraphContext(artifact, entities);
  const resolveLiveGeoAnchor = liveGeoAnchorResolver(entities);
  const allTime = buildEdgeSlice(
    artifact,
    historyContext.entitiesById,
    historyContext.relationships,
    'all-time',
    resolveLiveGeoAnchor,
  );
  const byDecade: Record<string, ExploreEdgeLineSlice> = {};
  for (const decade of historyContext.availableDecades) {
    byDecade[decade] = buildEdgeSlice(
      artifact,
      historyContext.entitiesById,
      historyContext.relationships,
      'decade',
      resolveLiveGeoAnchor,
      decade,
    );
  }
  return {
    edgeLineCatalog: { allTime, byDecade },
    availableDecades: historyContext.availableDecades,
  };
}

export function buildExploreViewModel(
  raw: RawExploreSearchParams,
  entities: readonly PublicEntityView[] = listPublicEntities(),
  dataSource: PublicReadSource = 'none',
  graphArtifact?: ReturnType<typeof getHistoryGraphReleaseArtifact>,
): ExploreViewModel {
  const viewState = parseExploreSearchParams(raw);
  const source = buildExploreMapSource(entities);
  const allFeatures = source.featureCollection.features;
  const filteredFeatures = applyExploreFilters(allFeatures, viewState.filters, viewState.state);
  const densityLevels = buildStateDensityLevels(source.stateAggregates);

  const { edgeLineCatalog, availableDecades } = buildEdgeLineCatalog(
    graphArtifact ?? getHistoryGraphReleaseArtifact(entities),
    entities,
  );
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
    availableDecades,
    entityDecades: buildEntityDecadeCounts(allFeatures),
    edgeLineCatalog,
    historyEdges: active.edges,
    edgeLineCollection: active.lineCollection,
    ...(selectedEdge ? { selectedEdge } : {}),
  };
}

export async function buildExploreViewModelAsync(
  raw: RawExploreSearchParams,
  entities: readonly PublicEntityView[] = listPublicEntities(),
  dataSource: PublicReadSource = 'none',
  options: { readonly releaseId?: string; readonly generatedAt?: string } = {},
): Promise<ExploreViewModel> {
  const artifact = await resolveHistoryGraphReleaseArtifact(entities, {
    ...(options.releaseId ? { releaseId: options.releaseId } : {}),
    ...(options.generatedAt ? { generatedAt: options.generatedAt } : {}),
  });
  return buildExploreViewModel(raw, entities, dataSource, artifact);
}
