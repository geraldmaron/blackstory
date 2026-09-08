/**
 * The Explore experience: the map-led instrument, its chrome, its filters, its records rail and
 * its preview — everything that is Explore rather than "a map".
 *
 * Generally reusable map machinery stays in `features/map`. This feature used to be split across
 * both trees, with `features/map/explore/` holding half the chrome and each barrel re-exporting
 * from the other; the route imported `ExploreView` from here and the sheet from there.
 */
export { ExploreView, type ExploreViewProps } from './ExploreView';
export {
  EntityPreviewSheet,
  type EntityPreviewSheetProps,
  type EntityPreviewPreviewFeature,
} from './EntityPreviewSheet';
export {
  formatExploreCountLabel,
  EXPLORE_SCOPE_NEARBY,
  EXPLORE_SCOPE_ALL_PINNED,
  type ExploreCountLabel,
  type ExploreCountLabelInput,
} from './explore-count-label';
export {
  shouldShowSparseViewportCoach,
  SPARSE_VIEWPORT_COACH_COPY,
  type SparseViewportCoachInput,
} from './sparse-viewport-coach';
export { exploreStoryMeta, type ExploreStoryMeta } from './explore-story-meta';
export {
  activeFilterChips,
  activeFilterCount,
  clearFilterKey,
  type ActiveFilterChip,
} from './active-filter-chips';
export { ExploreChromeFrame, ExploreListChrome } from './explore-chrome';
export {
  featureMetaLine,
  featureKindSlug,
  featureAtAGlanceFacts,
  type AtAGlanceFact,
  type PreviewMetaFeature,
} from './explore-meta';
export {
  ExploreFiltersPanel,
  filterStateFromPanel,
  EXPLORE_ERA_OPTIONS,
  type ExploreFiltersPanelProps,
  type ExploreEraOption,
} from './ExploreFiltersPanel';
export { MapColorKey, type MapColorKeyProps } from './MapColorKey';
export { ExploreRecordsRail, type ExploreRecordsRailProps } from './ExploreRecordsRail';
export {
  ExploreInstrumentsPanel,
  type ExploreInstrumentsPanelProps,
  type ExploreInstrumentsTab,
} from './ExploreInstrumentsPanel';
export {
  ExploreEditionSegmentTabs,
  ExploreEditionKicker,
  ExploreFacetRow,
  ExplorePanelHeader,
  ExploreRestoreChip,
  ExploreInstrumentsFrame,
} from './explore-edition-chrome';
export { exploreRecordFacts } from './explore-preview-facts';
export { useReduceMotion } from './useReduceMotion';
export {
  useExploreMapSource,
  type ExploreMapSourceState,
  type UseExploreMapSourceOptions,
} from './useExploreMapSource';
export {
  fetchMapSource,
  mapSourceV1ToFeatureCollection,
  MAP_PATH,
  type MapSourceDeps,
  type MapSourceFetchResult,
} from './map-source-client';

export {
  exploreReducer,
  initialExploreState,
  visibleFeatures,
  type ExploreState,
  type ExploreAction,
  type CameraCommand,
} from './explore-controller';
export {
  applyFilters,
  matchesFilters,
  countMatches,
} from './explore-filter';
export {
  clusterFeatures,
  resolveCluster,
  cellSizeDegrees,
  assertClusterPrecisionSafe,
  CLUSTER_ZOOM_STEP,
  type Cluster,
  type SinglePoint,
  type ClusterNode,
  type ClusterResolution,
} from './clustering';
export {
  toExploreFeature,
  toExploreFeatures,
  toMapFeatureCollection,
  sanitizeLabel,
  featureSubtitle,
  MAX_LABEL_LENGTH,
  type ExploreFeature,
  type ExploreFeatureProperties,
} from './explore-feature';
export {
  parseRestoredSelection,
  reconcileSelection,
  type RestoredSelection,
} from './selection';
