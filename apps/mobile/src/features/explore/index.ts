/**
 * Native Explore experience (MOB-012): the map + synchronized list + filters +
 * entity preview built on MOB-011's map feature. The Explore route imports
 * `ExploreView`; everything else is the pure, individually-tested core.
 */
export { ExploreView, type ExploreViewProps } from './ExploreView';
export { ExploreList, type ExploreListProps } from './ExploreList';
export { EntityPreviewSheet, type EntityPreviewSheetProps } from './EntityPreviewSheet';
export { useReduceMotion } from './useReduceMotion';

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
