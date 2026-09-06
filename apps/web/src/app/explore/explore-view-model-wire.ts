/**
 * Wire shapes for the Explore server -> client hand-off. Lives apart from `explore-view-model.ts`
 * because that module (via the history graph seed) reaches server-only imports (`node:crypto`);
 * this one must stay importable from the client island.
 *
 * Two halves cross the wire, by different routes:
 *
 * - `AtlasShellModel` is what `/` renders into its HTML: the parsed view state and the small
 *   request-scoped derivations (facets, counts, density levels). Tens of KB.
 * - The pin feature collection also rides the page (`AtlasLoader` `pins`). That is first paint.
 *   It is not the 15 MB catalog.
 * - `AtlasCatalogPayload` is the release-wide half (every feature, the history edge catalog, the
 *   cites edge), identical for every reader. It is NOT in the page; `GET /atlas/catalog` serves it
 *   with a CDN `Cache-Control` and the client fetches it once. See `atlas-catalog.ts`.
 *
 * `assembleExploreViewModel` puts the two back together into the `SerializableExploreViewModel`
 * `AtlasExperience` has always taken, so nothing below the loader knows the payload was split.
 *
 * `allFeatures` and `filteredFeatures` are pure derivations of `source` + `viewState`; shipping
 * them as props duplicated ~4k feature references three times in the RSC Flight payload, which
 * crashes React's dev deserializer (`RangeError: Invalid array length`) once the catalog is large
 * enough. The client rebuilds them with `hydrateExploreViewModel`.
 */
import { applyExploreFilters } from '../../lib/map-experience';
import type {
  ExploreMapFeatureCollection,
  ExploreMapSource,
} from '../../lib/map-experience/build-explore-map-source';
import type { PublicReadSource } from '../../lib/public-data/source';
import type { CitesEdgeIndex } from '../../lib/release/build-cites-edge';
import { pickExploreEdgeSlice, type ExploreEdgeLineCatalog } from './explore-edge-catalog';
import type { ExploreViewModel } from './explore-view-model';
import type { PaletteRecord } from '../../components/patterns/command-palette/CommandPalette';

/** Where the client fetches the catalog from. One path, one cache key. */
export const ATLAS_CATALOG_PATH = '/atlas/catalog';

const EMPTY_EDGE_CATALOG: ExploreEdgeLineCatalog = {
  allTime: { edges: [], lineCollection: { type: 'FeatureCollection', features: [] } },
  byDecade: {},
};

/**
 * Pin collection already on the page, shaped as a catalog so `AtlasExperience` can
 * paint the plate before `GET /atlas/catalog` arrives. No history edges, no cites:
 * those stay on the cached catalog route. Do not use this as `lastCatalog`.
 */
export function firstPaintCatalog(
  pins: ExploreMapFeatureCollection,
  dataSource: PublicReadSource,
): AtlasCatalogPayload {
  const generatedAt = new Date(0).toISOString();
  return {
    schemaVersion: 1,
    releaseId: 'first-paint',
    generatedAt,
    dataSource,
    source: {
      schemaVersion: 1,
      releaseId: 'first-paint',
      generatedAt,
      featureCollection: pins,
      stateAggregates: [],
      countyAggregates: [],
      jurisdictionAreaFeatures: [],
      meta: {
        totalEntities: pins.features.length,
        totalWithLocation: pins.features.length,
        totalFeatures: pins.features.length,
        skippedNoLocation: 0,
        skippedRedactedToNothing: 0,
        skippedOutsideUsBounds: 0,
      },
    },
    edgeLineCatalog: EMPTY_EDGE_CATALOG,
    availableDecades: [],
    citesEdge: {},
    // Unmapped entities are already absent from first paint's own pin collection, so this is a
    // real empty state, not a placeholder: `GET /atlas/catalog` fills it the same way it fills
    // the history edge catalog.
    unmappedPaletteRecords: [],
  };
}

export type SerializableExploreViewModel = Omit<
  ExploreViewModel,
  'allFeatures' | 'filteredFeatures'
>;

/** The release-wide half. Same bytes for every reader until the release changes. */
export type AtlasCatalogPayload = {
  readonly schemaVersion: 1;
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly dataSource: PublicReadSource;
  readonly source: ExploreMapSource;
  readonly edgeLineCatalog: ExploreEdgeLineCatalog;
  readonly availableDecades: readonly string[];
  readonly citesEdge: CitesEdgeIndex;
  /** See `ExploreViewModel`'s field of the same name (repo-jnmwu). Release-wide like every
   * other field here — derived from `source` alone, never from the reader's request. */
  readonly unmappedPaletteRecords: readonly PaletteRecord[];
};

/** The per-request half: everything in the view model the catalog does not carry. */
export type AtlasShellModel = Omit<
  SerializableExploreViewModel,
  | 'source'
  | 'edgeLineCatalog'
  | 'availableDecades'
  | 'citesEdge'
  | 'historyEdges'
  | 'edgeLineCollection'
  | 'selectedEdge'
  | 'unmappedPaletteRecords'
>;

export function toSerializableExploreViewModel(
  view: ExploreViewModel,
): SerializableExploreViewModel {
  const { allFeatures: _allFeatures, filteredFeatures: _filteredFeatures, ...serializable } = view;
  return serializable;
}

/** Splits a full view model into the half the page renders. */
export function toAtlasShellModel(view: ExploreViewModel): AtlasShellModel {
  const {
    allFeatures: _allFeatures,
    filteredFeatures: _filteredFeatures,
    source: _source,
    edgeLineCatalog: _edgeLineCatalog,
    availableDecades: _availableDecades,
    citesEdge: _citesEdge,
    historyEdges: _historyEdges,
    edgeLineCollection: _edgeLineCollection,
    selectedEdge: _selectedEdge,
    unmappedPaletteRecords: _unmappedPaletteRecords,
    ...shell
  } = view;
  return shell;
}

/**
 * Shell + catalog -> the serializable view model, exactly as the server used to build it: the
 * active edge slice is picked from the catalog by the shell's view state, and `selectedEdge`
 * resolves against that slice.
 */
export function assembleExploreViewModel(
  shell: AtlasShellModel,
  catalog: AtlasCatalogPayload,
): SerializableExploreViewModel {
  const active = pickExploreEdgeSlice(catalog.edgeLineCatalog, shell.viewState);
  const selectedEdge = shell.viewState.edge
    ? active.edges.find((edge) => edge.edgeId === shell.viewState.edge)
    : undefined;
  return {
    ...shell,
    source: catalog.source,
    edgeLineCatalog: catalog.edgeLineCatalog,
    availableDecades: catalog.availableDecades,
    citesEdge: catalog.citesEdge,
    unmappedPaletteRecords: catalog.unmappedPaletteRecords,
    historyEdges: active.edges,
    edgeLineCollection: active.lineCollection,
    ...(selectedEdge ? { selectedEdge } : {}),
  };
}

/** Rebuilds the derived feature arrays on the client from the serialized view model. */
export function hydrateExploreViewModel(
  serialized: SerializableExploreViewModel,
): ExploreViewModel {
  const allFeatures = serialized.source.featureCollection.features;
  return {
    ...serialized,
    allFeatures,
    filteredFeatures: applyExploreFilters(
      allFeatures,
      serialized.viewState.filters,
      serialized.viewState.state,
    ),
  };
}
