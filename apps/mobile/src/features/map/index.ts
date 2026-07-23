/**
 * Native map feature (MOB-011). Self-contained map surface that MOB-012 wires
 * into the Explore route. See MapScreen.tsx for why this is a feature component
 * rather than a route-tree edit.
 */
export { MapScreen, type MapScreenProps } from './MapScreen';
export {
  MapAttribution,
  MAP_ATTRIBUTION_ABOVE_SHEET_BOTTOM,
  type MapAttributionProps,
} from './MapAttribution';
export {
  buildBasemapStyle,
  ENTITY_POINT_LAYER_STYLE,
  ENTITY_POINT_RADIUS,
  ENTITY_SELECTED_RADIUS,
  ENTITY_CLUSTER_RADIUS_EXPR,
  assertNoHeatmapRegister,
  type MapStyleSpec,
} from './mapStyle';
export {
  classifyMapError,
  MAP_FAILURE_COPY,
  type MapFailureMode,
  type MapLoadState,
  type RawMapErrorSignal,
} from './mapLoadState';
export {
  MAP_ATTRIBUTION_LINES,
  MAP_PMTILES_URL,
  MAP_VECTOR_TILE_URL,
  MAP_GLYPHS_URL,
  MAP_LABEL_TEXT_FONT,
  DEFAULT_MAP_GLYPHS_URL,
  DEFAULT_OPENFREEMAP_TILE_SOURCE_URL,
  MAP_BASEMAP_ENABLED,
  MAP_FLAT_GEOJSON_MAX_GZIP_BYTES,
  MAP_FLAT_GEOJSON_MAX_FEATURE_COUNT,
} from './mapConfig';
export {
  DEMO_MAP_SOURCE,
  RAW_LIVING_PERSON,
  type MapFeatureCollection,
  type MapPointFeature,
  type MapPointFeatureProperties,
} from './demoMapSource';
export {
  ExploreToolbar,
  EntityPreviewSheet,
  featureMetaLine,
  featureKindSlug,
  featureAtAGlanceFacts,
} from './explore';
export type {
  ExploreToolbarProps,
  EntityPreviewSheetProps,
  EntityPreviewPreviewFeature,
  AtAGlanceFact,
  PreviewMetaFeature,
} from './explore';
export {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  US_BOUNDS,
  US_BBOX,
  US_CAMERA_MAX_BOUNDS,
  US_CAMERA_BOUNDS_PAD_DEG,
  PRESET_ZOOM,
  isInBounds,
  boundsForCoordinates,
  padBounds,
  cameraForPreset,
  cameraMotion,
  clampZoom,
  decimalPlaces,
  coordinateDecimals,
  coarsestDecimals,
  isNoMorePreciseThan,
  coarsenTo,
  type LngLat,
  type Bbox,
  type CameraPreset,
  type CameraTarget,
  type CameraMotion,
} from './mapCamera';
