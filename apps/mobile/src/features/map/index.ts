/**
 * Generally reusable map machinery: the renderer, the basemap, camera primitives, attribution,
 * failure classification, and the paint rules a map surface needs.
 *
 * It owns NOTHING that is specific to Explore. It used to: `features/map/explore/` held the
 * bottom sheet, the records rail, the filters panel, the instruments panel and the preview sheet,
 * and this barrel re-exported them — so Explore was split across two ownership trees that each
 * imported from the other, and "where does the records rail live" had two answers.
 *
 * Explore's own chrome is `features/explore`. A second map surface would reuse this file and
 * none of that.
 */
export { MapScreen, type MapScreenProps, type MapCameraCommand } from './MapScreen';
export {
  MapAttribution,
  MAP_ATTRIBUTION_ABOVE_SHEET_BOTTOM,
  MAP_ATTRIBUTION_Z_INDEX,
  type MapAttributionProps,
} from './MapAttribution';
export {
  buildBasemapStyle,
  ENTITY_POINT_LAYER_STYLE,
  ENTITY_POINT_RADIUS,
  ENTITY_SELECTED_RADIUS,
  ENTITY_SELECTED_LAYER_STYLE,
  ENTITY_SELECTED_INNER_LAYER_STYLE,
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
  MAP_ATTRIBUTION_LINES_COMPACT,
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
  CINEMATIC_MAP_INITIAL_STATE,
  cinematicMapReducer,
  type CinematicMapAction,
  type CinematicMapReducerState,
  type CinematicMapState,
} from './cinematic-map-state';
export {
  useCinematicMap,
  type CinematicMapCameraCommand,
  type UseCinematicMapOptions,
  type UseCinematicMapResult,
} from './useCinematicMap';
export {
  ENTITY_SELECTED_PULSE_DURATION_MS,
  ENTITY_SELECTED_PULSE_SCALE_FROM,
  ENTITY_SELECTED_PULSE_SCALE_TO,
  ENTITY_SELECTED_PULSE_OPACITY_FROM,
  ENTITY_SELECTED_PULSE_OPACITY_TO,
  ENTITY_SELECTED_PULSE_STATIC_SCALE,
  ENTITY_SELECTED_PULSE_STATIC_OPACITY,
  pulseEaseInOut,
  entitySelectedPulseLayerStyle,
  entitySelectedPulseStaticLayerStyle,
} from './entity-paint';
export {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  US_BOUNDS,
  US_BBOX,
  US_CAMERA_MAX_BOUNDS,
  US_CAMERA_BOUNDS_PAD_DEG,
  WEST_COAST_CLEARANCE_LNG,
  EXPLORE_MAP_VIEW_PADDING,
  PRESET_ZOOM,
  isInBounds,
  boundsForCoordinates,
  boundsLngSpan,
  minZoomToFrameLngSpan,
  nationalBoundsClearWestCoast,
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
