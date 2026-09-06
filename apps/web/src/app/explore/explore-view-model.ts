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
import { resolveCitesEdgeIndex } from '../../lib/articles/source';
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
  exploreMapSourceFor,
  type ExploreMapFeature,
  type ExploreMapSource,
} from '../../lib/map-experience/build-explore-map-source';
import { buildUnmappedPaletteRecords } from '../../lib/map-experience/build-palette-records';
import type { PublicReadSource } from '../../lib/public-data/source';
import type { PaletteRecord } from '../../components/patterns/command-palette/CommandPalette';
import type { CitesEdgeIndex } from '../../lib/release/build-cites-edge';
import {
  pickExploreEdgeSlice,
  type ExploreEdgeLineCatalog,
  type ExploreEdgeLineSlice,
} from './explore-edge-catalog';

import type { AtlasShellModel } from './explore-view-model-wire';

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
  /**
   * Chapter-cites-record edge for the whole catalog (SP-20). Ships with the view model rather
   * than being fetched on select: it is one small string map (only records some chapter actually
   * cites appear), and the sheet must be able to state "no chapter cites this yet" instantly
   * instead of holding a spinner over an answer that is usually empty.
   */
  readonly citesEdge: CitesEdgeIndex;
  /**
   * Palette records for entities `exploreMapSourceFor` had no map feature for — mostly laws,
   * cases, and national organizations with no resolvable `geoAnchor` (repo-jnmwu). Release-wide
   * and reader-independent, so it rides the catalog half of the wire split like `citesEdge`
   * rather than the per-request shell. See `build-palette-records.ts`'s
   * `buildUnmappedPaletteRecords`.
   */
  readonly unmappedPaletteRecords: readonly PaletteRecord[];
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
 * shared by the explore view model and the home hero's decades-in-motion flow.
 *
 * Decades are id lists into `allTime` (see `explore-edge-catalog.ts`). A decade edge is the same
 * relationship as its all-time counterpart, so only ids are kept; an edge a decade view names
 * that the all-time view does not is dropped here, because the client can only slice what
 * `allTime` carries. */
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
  const allTimeIds = new Set(allTime.edges.map((edge) => edge.edgeId));
  const byDecade: Record<string, readonly string[]> = {};
  for (const decade of historyContext.availableDecades) {
    const slice = resolveHistoryGraphSlice(artifact, 'decade', decade);
    const edges = buildHistoryEdges(
      slice,
      historyContext.relationships,
      historyContext.entitiesById,
      new Set(slice.nodeIds),
    );
    byDecade[decade] = edges.map((edge) => edge.edgeId).filter((id) => allTimeIds.has(id));
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
  citesEdge: CitesEdgeIndex = {},
): ExploreViewModel {
  const viewState = parseExploreSearchParams(raw);
  const source = exploreMapSourceFor(entities);
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
  const mappedEntityIds = new Set(allFeatures.map((feature) => feature.properties.entityId));

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
    citesEdge,
    unmappedPaletteRecords: buildUnmappedPaletteRecords(entities, mappedEntityIds),
    ...(selectedEdge ? { selectedEdge } : {}),
  };
}

/**
 * The request-scoped half of the view model, for `/` to render: everything that depends on the
 * URL plus the small catalog derivations the no-JS fallback and the facets need. Builds the map
 * source (the catalog is already in process memory) but never the history edge catalog, the
 * graph artifact or the cites edge — those are release-wide and arrive via `/atlas/catalog`.
 * `noscriptFeatures` is the filtered list for the `<noscript>` fallback; the client rebuilds the
 * same list from the catalog.
 */
export function buildAtlasShell(
  raw: RawExploreSearchParams,
  entities: readonly PublicEntityView[] = listPublicEntities(),
  dataSource: PublicReadSource = 'none',
): {
  readonly shell: AtlasShellModel;
  readonly noscriptFeatures: readonly ExploreMapFeature[];
} {
  const viewState = parseExploreSearchParams(raw);
  const source = exploreMapSourceFor(entities);
  const allFeatures = source.featureCollection.features;
  const filteredFeatures = applyExploreFilters(allFeatures, viewState.filters, viewState.state);
  return {
    shell: {
      viewState,
      densityLevels: buildStateDensityLevels(source.stateAggregates),
      facetOptions: buildExploreFacetOptions(allFeatures),
      totalMatched: filteredFeatures.length,
      dataSource,
      entityDecades: buildEntityDecadeCounts(allFeatures),
    },
    noscriptFeatures: filteredFeatures,
  };
}

export async function buildExploreViewModelAsync(
  raw: RawExploreSearchParams,
  entities: readonly PublicEntityView[] = listPublicEntities(),
  dataSource: PublicReadSource = 'none',
  options: {
    readonly releaseId?: string;
    readonly generatedAt?: string;
    /** Injected in tests; defaults to the active release's article read. */
    readonly loadCitesEdge?: () => Promise<CitesEdgeIndex>;
  } = {},
): Promise<ExploreViewModel> {
  const [artifact, citesEdge] = await Promise.all([
    resolveHistoryGraphReleaseArtifact(entities, {
      ...(options.releaseId ? { releaseId: options.releaseId } : {}),
      ...(options.generatedAt ? { generatedAt: options.generatedAt } : {}),
    }),
    (options.loadCitesEdge ?? resolveCitesEdgeIndex)(),
  ]);
  return buildExploreViewModel(raw, entities, dataSource, artifact, citesEdge);
}
