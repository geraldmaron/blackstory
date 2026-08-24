/**
 * Picks the active History edge/line slice for Explore from a precomputed catalog.
 * Kept free of graph-release builders so client components can import it safely.
 *
 * The catalog carries every edge ONCE (`allTime`) and each decade as a list of edge ids into
 * it. The earlier shape shipped a full `{ edges, lineCollection }` per decade, and because a
 * decade edge is byte-identical to its all-time counterpart (same relationship, same citations,
 * same geo anchors), that was the same 746 edges serialised ~40 times over — 7 MB of an 8.5 MB
 * catalog on the wire. Slicing here costs one pass over `allTime` per decade change.
 */
import type { ExploreViewState } from '../../lib/map-experience/url-state';
import type { HistoryEdgeLineCollection } from '../../lib/map-experience/build-history-edge-lines';
import type { HistoryEdgeView } from '../../lib/history/build-history-graph';

export type ExploreEdgeLineSlice = {
  readonly edges: readonly HistoryEdgeView[];
  readonly lineCollection: HistoryEdgeLineCollection;
};

export type ExploreEdgeLineCatalog = {
  readonly allTime: ExploreEdgeLineSlice;
  /** Decade label -> ids of the `allTime` edges active in that decade. */
  readonly byDecade: Readonly<Record<string, readonly string[]>>;
};

const EMPTY_SLICE: ExploreEdgeLineSlice = {
  edges: [],
  lineCollection: { type: 'FeatureCollection', features: [] },
};

/** Materialises one decade's slice from the all-time edges and line features. */
export function sliceExploreEdgeCatalog(
  catalog: ExploreEdgeLineCatalog,
  decade: string,
): ExploreEdgeLineSlice | undefined {
  const ids = catalog.byDecade[decade];
  if (!ids) return undefined;
  const wanted = new Set(ids);
  return {
    edges: catalog.allTime.edges.filter((edge) => wanted.has(edge.edgeId)),
    lineCollection: {
      type: 'FeatureCollection',
      features: catalog.allTime.lineCollection.features.filter((feature) =>
        wanted.has(feature.properties.edgeId),
      ),
    },
  };
}

export function pickExploreEdgeSlice(
  catalog: ExploreEdgeLineCatalog,
  viewState: Pick<ExploreViewState, 'lines' | 'decade'>,
): ExploreEdgeLineSlice {
  if (!viewState.lines) return EMPTY_SLICE;
  if (viewState.decade) {
    const slice = sliceExploreEdgeCatalog(catalog, viewState.decade);
    if (slice) return slice;
  }
  return catalog.allTime;
}
