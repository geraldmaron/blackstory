/**
 * Native Explore experience (MOB-012): map edition chrome, filters, and entity
 * preview built on MOB-011's map feature. The Explore route imports
 * `ExploreView`; everything else is the pure, individually-tested core.
 */
export { ExploreView, type ExploreViewProps } from './ExploreView';
export {
  EntityPreviewSheet,
  type EntityPreviewSheetProps,
  type EntityPreviewPreviewFeature,
} from '@/features/map/explore';
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
