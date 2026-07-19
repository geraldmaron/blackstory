/**
 * Picks the active History edge/line slice for Explore from a precomputed catalog.
 * Kept free of graph-release builders so client components can import it safely.
 */
import type { ExploreViewState } from '../../../lib/map-experience/url-state';
import type { HistoryEdgeLineCollection } from '../../../lib/map-experience/build-history-edge-lines';
import type { HistoryEdgeView } from '../../../lib/history/build-history-graph';

export type ExploreEdgeLineSlice = {
  readonly edges: readonly HistoryEdgeView[];
  readonly lineCollection: HistoryEdgeLineCollection;
};

export type ExploreEdgeLineCatalog = {
  readonly allTime: ExploreEdgeLineSlice;
  readonly byDecade: Readonly<Record<string, ExploreEdgeLineSlice>>;
};

const EMPTY_SLICE: ExploreEdgeLineSlice = {
  edges: [],
  lineCollection: { type: 'FeatureCollection', features: [] },
};

export function pickExploreEdgeSlice(
  catalog: ExploreEdgeLineCatalog,
  viewState: Pick<ExploreViewState, 'lines' | 'decade'>,
): ExploreEdgeLineSlice {
  if (!viewState.lines) return EMPTY_SLICE;
  if (viewState.decade && catalog.byDecade[viewState.decade]) {
    return catalog.byDecade[viewState.decade]!;
  }
  return catalog.allTime;
}
