'use client';

/**
 * The persistent map canvas (`docs/decisions-carryover.md`, "Persistent map canvas").
 * `MapStageProvider` mounts once in the root shell (`components/SiteShell.tsx`), above every
 * route, so it never remounts on navigation: only the page tree beneath it swaps. That means
 * this component's mount effect below runs exactly once per page load, and the WebGL context,
 * loaded tiles, and camera all survive route changes by construction, not by choreography.
 * The decision's own wording ("across hero and explore") predates the root-shell hoist: the
 * canvas now outlives navigation to every route, not just the two map surfaces.
 *
 * The outer shape is a long-lived provider, not a props-driven component a page mounts and
 * unmounts: pages drive it through the imperative API (`patchData` / `applyViewState` /
 * `flyPreset` / `subscribe`) that `useMapStage()` returns. The instance-lifecycle code and every
 * mutation helper below (`applyGeographyStyle`, `setSelectedStateFilter`, `setHistoryEdgeData`,
 * `syncEntityHover`, …) sit behind that API; each export's own doc comment states its
 * contract.
 *
 * `maplibre-gl`'s runtime is only ever dynamically imported here, and this is the only module
 * that constructs a map. `map-libre-lifecycle.test.ts` greps `apps/web/src` for
 * `new maplibregl.Map` and fails if a second mount appears; every other module takes
 * `import type` only (`docs/decisions-carryover.md`, "Persistent map canvas": one instance).
 * The stylesheet is a plain static import below, not a dynamic one.
 */
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
  Marker,
  StyleSpecification,
} from 'maplibre-gl';
import type * as MapLibreNamespace from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { queryRenderedLayers } from './query-rendered';
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import {
  EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
  EXPLORE_ENTITIES_SOURCE_ID,
  EXPLORE_COUNTY_LABEL_LAYER_ID,
  EXPLORE_LIGHTS_LAYER_ID,
  EXPLORE_HISTORY_EDGES_INCOMING_SOURCE_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from '../../app/map/explore-layer-ids';
import { buildExploreMapStyle, lightsOpacity, ORBIT_MAX_ZOOM } from '../../app/map/explore-style';
import {
  applyDensityBlendProgress,
  applyDecadeHoldFeatureState,
  buildDecadeHoldSet,
  buildDensityColorMorphStates,
  clearDecadeHoldFeatureState,
  entityIdsInCollection,
  clearDensityMorphFeatureState,
  DECADE_LAYER_FADE_MS,
  runDecadeMorphAnimation,
  restoreDecadeFadePaintFromStyle,
  setDecadeCrossfadeTransitions,
  type DecadeMorphAnimationHandle,
  type DensityColorMorphState,
} from '../../app/map/decade-layer-transition';
import {
  bindMapResizeLifecycle,
  bindWebGlContextRecovery,
  isWebGlAvailable,
  resizeMapInPlace,
} from '../../lib/map-experience/map-libre-lifecycle';
import {
  ENTITY_POINTER_HIT_LAYER_IDS,
  MAP_CLICK_TOLERANCE_PX,
  pointerHitBox,
  resolveEntityPointerHit,
} from '../../lib/map-experience/entity-pointer-hit';
import type {
  ExploreMapFeatureCollection,
  JurisdictionAreaFeature,
} from '../../lib/map-experience/build-explore-map-source';
import {
  CAMERA_EASING_SLOW_OUT,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  PLATE_OPENING_PADDING_PX,
  prefersFinePointer,
  prefersReducedMotion,
  type CameraPresetName,
} from '../../lib/map-experience/camera-presets';
import type { HistoryEdgeLineCollection } from '../../lib/map-experience/build-history-edge-lines';
import { drawnRecordCollection } from '../../lib/map-experience/record-marks';
import { placeDrillZoom, SITE_MIN_ZOOM } from '../../lib/map-experience/place-map';
import type { StateDensityLevel } from '../../lib/map-experience/density';
import type { CountyChoroplethLevel } from '../../lib/map-experience/county-choropleth';
import type { StateChoroplethLevel } from '../../lib/map-experience/state-choropleth';
import {
  joinDensityOntoStatePolygons,
  indexDensityFillColors,
} from '../../lib/map-experience/join-state-polygons';
import type { ExploreLayerMode, ExploreViewportFrame } from '../../lib/map-experience/url-state';
import {
  DEFAULT_POPULATION_GEO,
  type ExplorePopulationGeo,
} from '../../lib/map-experience/explore-population';
import {
  buildArchiveBaseStyle,
  PERSISTENT_PLATE_LAYER_IDS,
  syncLayerPaintFromStyle,
} from './map-plate-paint';
import {
  buildExploreSearchCenterMarkerElement,
  type ExploreSearchCenterMarkerInput,
} from '../../lib/map-experience/explore-search-marker';
import { readDocumentColorScheme } from './color-scheme';
import { buildSelectionFlagElement } from './selection-flag';
import { kindLabelForMark } from '../entity/record-mark';
import { rowDecadeLabel } from '../../lib/map-experience/explore-rows';
import { bindPlaceLabels, type PlaceLabelsHandle } from './place-labels';
import { dropInIncomingPins } from './selection-sync';
import { EXPLORE_GHOSTS_SOURCE_ID } from '../../app/map/explore-layer-ids';
import { recordMarkFor } from '../../lib/map-experience/geo-precision';
import { EMPTY_EDGE_COLLECTION, EMPTY_FEATURE_COLLECTION, type StageConfig } from './stage-config';
import {
  applyGeographyStyle,
  applyOrbitLineFloor,
  buildStyleForScheme,
  setSelectedStateFilter,
} from './style-application';
import {
  setHistoryEdgeData,
  setHistoryEdgesVisibility,
  setSelectedEdgeFilter,
  setHoveredEntityFilter,
  setSelectedEntityFilter,
} from './selection-sync';
import {
  entitiesSourceData,
  fetchStatePolygons,
  loadStatePolygonsWithDensity,
  requestCountyPolygonLoad,
  setPlaceLeaderData,
  waitForGeoJsonSourceData,
} from './geo-source-loaders';
import { readViewport } from './viewport-geometry';
import {
  makeListenerStore,
  notify,
  type MapStageEventName,
  type MapStageEvents,
} from './listener-store';
import {
  runFlyPreset as runFlyPresetOnMap,
  type CameraFlyTarget,
  type MapStageFlyOptions,
} from './camera';
import { bindPlateCameraListeners, bindPlateClickListeners } from './event-wiring';
import { usePathname } from 'next/navigation';
import { surfaceClassFor, type SurfaceClass } from '../../lib/nav/surface-classes';
import { useSurfaceClass } from '../../lib/nav/use-surface-class';
import { defaultPostureFor, framedClaimAllowed, type PlatePosture } from './plate-posture';
import { createFramedSlotRegistry } from './framed-slot-registry';
import { boxIsPaintable, plateBoxForSlot, resolvePlatePosture, type PlateBox } from './plate-frame';
import {
  applyGesturesForPosture,
  gesturePolicyFor,
  lockGestures,
  rotateGestureAllowed,
} from './gesture-lock';
import {
  attachSafariPageZoomGuard,
  attachSafariTwistRotate,
  attachShiftDragRotate,
  attachShiftWheelRotate,
  type RotateGestureHandle,
} from './custom-rotate-gestures';
import { createReducedMotionListener, type ReducedMotionListener } from './reduced-motion-listener';
// The plate is the subscriber half of the seam `MapMoment` documents: the stage publishes which
// moment is live and where, and never touches a map itself.
import {
  resolveMomentCamera,
  useMapMomentFrame,
  useReportMapAvailability,
} from '../room/MapMoment';

/**
 * Give the slot geometry back, so the plate returns to its resting full-viewport box and the
 * reading-room cover applies again. Paired with the `data-plate-slot` write in the Framed path;
 * kept as one function because dropping the attribute while leaving the custom properties set
 * (or the reverse) is the failure that leaves a plate painted over a prose column.
 */
function releasePlateSlot(plate: HTMLDivElement): void {
  delete plate.dataset.plateSlot;
  plate.style.removeProperty('--ds-plate-frame-top');
  plate.style.removeProperty('--ds-plate-frame-left');
  plate.style.removeProperty('--ds-plate-frame-width');
  plate.style.removeProperty('--ds-plate-frame-height');
}

/** Locator underlay hides; camera, pin clicks, and MapLibre gestures reach the live plate. */
function stampPlateReady(plate: HTMLDivElement | null): void {
  if (plate) plate.dataset.plateReady = '1';
}

type MaplibreModule = typeof MapLibreNamespace;

// ---------------------------------------------------------------------------------------------
// Public stage API
// ---------------------------------------------------------------------------------------------

/** Source-data + mode flags a surface (home hero, explore) hands the stage. The stage rebuilds
 * its MapLibre style from this every call (via `buildExploreMapStyle`, 's style builder —
 * consumed here, never modified) and reapplies geography layers + resyncs entity markers. Always
 * the FULL current shape, not a delta — mirrors how `ExploreMapCanvas` used to receive these as
 * plain re-render props. */
export type MapStageDataPatch = {
  readonly featureCollection: ExploreMapFeatureCollection;
  /** Records the lens matches outside the brushed decades, drawn as sand ghosts. */
  readonly ghostCollection?: ExploreMapFeatureCollection;
  readonly jurisdictionAreaFeatures: readonly JurisdictionAreaFeature[];
  readonly layerMode: ExploreLayerMode;
  readonly popGeo?: ExplorePopulationGeo;
  readonly densityLevels: readonly StateDensityLevel[];
  readonly stateChoroplethLevels?: readonly StateChoroplethLevel[];
  readonly countyChoroplethLevels?: readonly CountyChoroplethLevel[];
  /** When false, recreate the entities source without MapLibre clustering. Omitted patches keep the current stage value (default false). */
  readonly clusteringEnabled?: boolean;
  /** Aerial imagery basemap instead of the flat plate. Omitted patches keep the current value. */
  readonly satellite?: boolean;
  readonly historyEdgesEnabled: boolean;
  readonly historyEdgeCollection: HistoryEdgeLineCollection;
};

/** Selection-only view state: cheap filter/paint updates, no style rebuild. `undefined` clears
 * the corresponding selection (always pass both — this is the current full selection, not a
 * delta, same convention as `MapStageDataPatch`). */
export type MapStageViewPatch = {
  readonly selectedState: string | undefined;
  readonly selectedEdge: string | undefined;
  /** Copper orientation ring on the map for a focused record (e.g. return from entity page). */
  readonly selectedEntity?: string | undefined;
};

export type { CameraFlyTarget, MapStageFlyOptions } from './camera';

/** Optional behavior for `patchData`. `fade` runs a dual-buffer crossdissolve on
 * presence fills, pins, and relationship lines when motion is allowed — geography
 * never empties. */
export type MapStageDataPatchOptions = {
  readonly fade?: boolean;
};

export type { ExploreSearchCenterMarkerInput };

export type SearchAreaInput = {
  readonly lng: number;
  readonly lat: number;
  readonly radiusMeters?: number | null;
  readonly accuracyMeters?: number | null;
};

const SEARCH_AREA_SOURCE = 'ds-search-area';
const SEARCH_AREA_FILL = 'ds-search-area-fill';
const SEARCH_AREA_LINE = 'ds-search-area-line';

function circlePolygon(lng: number, lat: number, meters: number, steps = 72): number[][] {
  const ring: number[][] = [];
  const latRad = (lat * Math.PI) / 180;
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.max(0.01, Math.cos(latRad)));
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    ring.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)]);
  }
  return ring;
}

function searchAreaCollection(area: SearchAreaInput | null) {
  const features: {
    type: 'Feature';
    properties: { role: 'radius' | 'accuracy' };
    geometry: { type: 'Polygon'; coordinates: number[][][] };
  }[] = [];
  if (area?.radiusMeters && area.radiusMeters > 0) {
    features.push({
      type: 'Feature',
      properties: { role: 'radius' },
      geometry: {
        type: 'Polygon',
        coordinates: [circlePolygon(area.lng, area.lat, area.radiusMeters)],
      },
    });
  }
  // Accuracy under ~25 m is smaller than the dot itself; drawing it only adds noise.
  if (area?.accuracyMeters && area.accuracyMeters > 25) {
    features.push({
      type: 'Feature',
      properties: { role: 'accuracy' },
      geometry: {
        type: 'Polygon',
        coordinates: [circlePolygon(area.lng, area.lat, Math.min(area.accuracyMeters, 50_000))],
      },
    });
  }
  return { type: 'FeatureCollection' as const, features };
}

export type MapStageHandle = {
  /** Patches source data + density/history-edge mode flags; rebuilds the style and reapplies
   * geography layers + entity markers. Pass `{ fade: true }` for decade-flow dual-buffer
   * crossdissolve (presence colors morph; plate never blanks). */
  readonly patchData: (patch: MapStageDataPatch, options?: MapStageDataPatchOptions) => void;
  /** Patches the selected-state / selected-edge highlight filters (and the state-label
   * selection color) without touching source data or the style. */
  readonly applyViewState: (patch: MapStageViewPatch) => void;
  /** The sanctioned route for preset framing. Raw library defaults are policy-banned, though
   * this file's own MapMoment framing effect is a confirmed live exception
   * (`docs/decisions-carryover.md`, "Persistent map canvas": camera grammar).
   * Resolves `target` (an explicit center+zoom, or a bounding box via `cameraForBounds`), then
   * flies/eases/jumps according to `name`'s preset and the current reduced-motion state. */
  readonly flyPreset: (
    name: CameraPresetName,
    target: CameraFlyTarget,
    options?: MapStageFlyOptions,
  ) => void;
  /** `false` once the canvas has failed to start (WebGL unavailable, marker mount threw); pages
   * render their own graceful fallback notice off this. */
  readonly mapAvailable: boolean;
  /** Subscribes to one canvas event; returns an unsubscribe function. `'error'` and `'viewport'`
   * replay their latest value immediately to a subscriber that attaches after the fact (the
   * stage may already be alive with state from a previous page). */
  readonly subscribe: <E extends MapStageEventName>(
    event: E,
    handler: (...args: MapStageEvents[E]) => void,
  ) => () => void;
  /** Copper place pin at a geocoded search center — distinct from entity HTML markers. */
  readonly setSearchCenterMarker: (marker: ExploreSearchCenterMarkerInput) => void;
  readonly clearSearchCenterMarker: () => void;
  /**
   * Translucent circles around a located point: the search radius the reader chose and/or the
   * device's accuracy. Real geographic circles (a GeoJSON layer), so they scale with zoom and
   * lie flat under pitch. `null` clears them.
   */
  readonly setSearchArea: (area: SearchAreaInput | null) => void;
  /** Re-read container layout after external geometry changes (hero inset, panel open). */
  readonly resize: () => void;
  /**
   * Door browse morph: force Live posture (reader-steered gestures) while the journey surface
   * stays mounted on `/`. Clears back to the surface-class default when browse ends.
   */
  readonly setDoorBrowseLive: (live: boolean) => void;
  /**
   * Whether place tokens (counts and names) and site names draw. A surface that flies the camera
   * to one record (the Door's tour) turns them off, so the flight does not pass through every
   * state, county and city count on the way; the surface turns them back on when it is done.
   */
  readonly setPlaceTokens: (shown: boolean) => void;
  /**
   * Whether the map's own text (street, city, state and county names) draws. A surface that
   * moves the camera every frame (the Door's scroll scrub) turns it off while it travels: at
   * that speed no name can be read, and placing them is the largest per-frame cost of a dive
   * (about a third of main-thread time on a throttled phone). On again, each layer returns to
   * the visibility it had.
   */
  readonly setMapLabels: (shown: boolean) => void;
  /**
   * The live MapLibre map, or null before it starts and after it fails.
   *
   * Deliberately narrow: `camera-moves.ts` drives the plate through a structural `MapLike`, and
   * this is how that library reaches the one persistent canvas. It is not an invitation to call
   * `flyTo` with library defaults through THIS handle. A caller that reaches past `flyPreset`
   * owes the move its own authored duration, curve and easing, the way `camera-moves.ts` does
   * (`docs/decisions-carryover.md`, "Persistent map canvas": camera grammar). This file's own
   * MapMoment framing effect reaches the map directly, not through this handle, and is a
   * confirmed exception to that norm today. `flyPreset` remains the route for preset framing.
   */
  readonly getMap: () => AtlasCameraTarget | null;
};

/** What the camera library needs off the map. Structural, so `MapStage` owes it no import. */
export type AtlasCameraTarget = {
  flyTo(options: never): unknown;
  easeTo(options: never): unknown;
  fitBounds(bounds: never, options: never): unknown;
  cameraForBounds(bounds: never, options: never): { zoom?: number } | undefined;
  setMinZoom(zoom: number): unknown;
  getZoom(): number;
  getBearing(): number;
  getPitch(): number;
  getCenter(): { lng: number; lat: number };
  /** The element MapLibre draws in — the box a surface frames its camera against. */
  getContainer(): HTMLElement;
  /** Screen position of a coordinate — `frameRecord`'s "already visible" test. */
  project(lngLat: never): { x: number; y: number };
  /** Whether a flight, ease or gesture is in progress — a refit must not cut one short. */
  isMoving(): boolean;
  /** One callback when the current move ends: for work that must wait for the camera to land. */
  once(type: 'moveend', listener: () => void): unknown;
  stop(): unknown;
};

const MapStageContext = createContext<MapStageHandle | null>(null);

export function useMapStage(): MapStageHandle {
  const ctx = useContext(MapStageContext);
  if (!ctx) {
    throw new Error('useMapStage() must be called within a MapStageProvider');
  }
  return ctx;
}

/**
 * The stage, or null where no provider is above. `RecordGround` renders inside a server-streamed
 * record page, and its server render does not see the root shell's context (the throw above made
 * React abandon server rendering for the record's whole boundary). It only acts in effects, so on
 * the server it needs nothing.
 */
export function useOptionalMapStage(): MapStageHandle | null {
  return useContext(MapStageContext);
}

/** From this zoom the globe and Mercator draw the same picture, so a switch cannot be seen. */
const GLOBE_INVISIBLE_ZOOM = 8;

/** Hover-intent delay before a pin's photo card opens (`PinPhotoCard`'s own doc comment). */
const PIN_HOVER_INTENT_MS = 120;

/** The box a hovered or selected record's photo card anchors to: the disc's footprint on screen,
 * the same 8px square the HTML hit-target disc used to occupy. */
const ENTITY_ANCHOR_SIZE_PX = 8;

type EntityPoint = {
  readonly name: string;
  /** The callout's meta line: the record's kind and decade, when it has them. */
  readonly meta: string;
  readonly lng: number;
  readonly lat: number;
  /** False for county- and state-precision records, which draw no point. */
  readonly drawn: boolean;
};

/** Point records by id, so a hover or a selection finds its record without scanning thousands. */
function indexEntityPoints(
  features: ExploreMapFeatureCollection['features'],
): ReadonlyMap<string, EntityPoint> {
  const byId = new Map<string, EntityPoint>();
  for (const feature of features) {
    if (feature.geometry.type !== 'Point') continue;
    const [lng, lat] = feature.geometry.coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number') continue;
    const props = feature.properties;
    const entityId = props.entityId;
    if (typeof entityId !== 'string' || byId.has(entityId)) continue;
    byId.set(entityId, {
      name: typeof props.displayName === 'string' ? props.displayName : 'Documented record',
      meta: [
        kindLabelForMark(props.kind),
        Array.isArray(props.eraBuckets) && props.eraBuckets.length > 0
          ? rowDecadeLabel(props.eraBuckets, undefined)
          : undefined,
      ]
        .filter((part) => part && part !== 'Undated')
        .join(' · '),
      lng,
      lat,
      drawn: recordMarkFor(props.precision) !== 'none',
    });
  }
  return byId;
}

/**
 * All four data props are optional, and the root layout passes none of them.
 *
 * Awaiting `loadMapStageBase()` in the root layout would make every route in the app
 * `force-dynamic`, including the ones that must stay static and keep `generateStaticParams`. The
 * provider does not need a server-built resting frame anyway: `commitDataPatch` rebuilds the
 * entire style from the patch, so the first `patchData` a plate-bearing surface sends carries
 * everything. A surface that wants a plate still does its own `await loadMapStageBase()` in its
 * own server component and hands the result down as that first patch.
 */
export type MapStageProviderProps = {
  readonly initialStyle?: StyleSpecification;
  readonly initialFeatureCollection?: ExploreMapFeatureCollection;
  readonly initialJurisdictionAreaFeatures?: readonly JurisdictionAreaFeature[];
  readonly bounds?: readonly [west: number, south: number, east: number, north: number];
  readonly children: ReactNode;
};

function SearchAwareSurfaceClass({
  onChange,
}: {
  readonly onChange: (surface: SurfaceClass | null) => void;
}) {
  const surface = useSurfaceClass();
  useEffect(() => {
    onChange(surface);
  }, [surface, onChange]);
  return null;
}

export function MapStageProvider({
  initialStyle,
  initialFeatureCollection,
  initialJurisdictionAreaFeatures,
  bounds,
  children,
}: MapStageProviderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  /** The fixed plate itself, so the Framed posture can write its inset without a re-render. */
  const plateRef = useRef<HTMLDivElement | null>(null);
  /**
   * The one-Framed-slot guard. A ref rather than a module singleton so two providers in a test
   * render do not share a slot, and so the registry dies with the provider that owns it.
   */
  const framedSlotsRef = useRef(createFramedSlotRegistry());
  const heldSlotRef = useRef<string | null>(null);
  /** The moment the camera last flew to, so a scroll frame does not restart the flight. */
  const lastFramedMomentRef = useRef<string | null>(null);
  /**
   * The document-space box last written to the plate, so a scroll frame that changes nothing
   * writes nothing.
   *
   * `plateBoxForSlot` is stable across a scroll — that is the point of positioning in document
   * space — so during a gesture every frame recomputes the same four numbers. Writing them anyway
   * would dirty style on the plate sixty times a second and, worse, invite a `map.resize()` per
   * frame: MapLibre re-measures its container and reallocates the WebGL drawing buffer, which is
   * what made the map flash inside its own frame mid-scroll. Comparing first means the geometry
   * is touched only when the slot genuinely moves or resizes — a reflow, a drawer, a window
   * resize — and a scroll gesture costs one rect read and nothing else.
   */
  const lastFramedBoxRef = useRef<PlateBox | null>(null);
  const reducedMotionRef = useRef<ReducedMotionListener | null>(null);
  const pathname = usePathname();
  /**
   * Pathname-only first. `/` is always a reading room, even with a leftover query.
   * `/explore` is the instrument. Calling `useSearchParams` on this provider would
   * suspend the whole shell.
   */
  const [surfaceClass, setSurfaceClass] = useState<SurfaceClass | null>(() =>
    surfaceClassFor(pathname ?? '/'),
  );
  const onSearchAwareSurface = useCallback((next: SurfaceClass | null) => {
    setSurfaceClass(next);
  }, []);
  useEffect(() => {
    setSurfaceClass(surfaceClassFor(pathname ?? '/'));
  }, [pathname]);
  const [posture, setPosture] = useState<PlatePosture>(() =>
    defaultPostureFor(surfaceClassFor(pathname ?? '/')),
  );
  /** Door in-place browse: Live gestures without leaving the Door route tree. */
  const [doorBrowseLive, setDoorBrowseLiveState] = useState(false);
  const doorBrowseLiveRef = useRef(false);
  doorBrowseLiveRef.current = doorBrowseLive;
  const setDoorBrowseLive = useCallback((live: boolean) => {
    doorBrowseLiveRef.current = live;
    setDoorBrowseLiveState(live);
  }, []);
  const setPlaceTokens = useCallback((shown: boolean) => {
    plateRef.current?.toggleAttribute('data-tokens-off', !shown);
    const map = mapRef.current;
    // With the tokens down the lights carry the records all the way to the pins
    // (`lightsOpacity`); `applyGeographyStyle` leaves this channel alone while they are down.
    if (map?.getLayer(EXPLORE_LIGHTS_LAYER_ID)) {
      map.setPaintProperty(EXPLORE_LIGHTS_LAYER_ID, 'circle-opacity', lightsOpacity(!shown));
    }
    // County names go with the tokens. The basemap prints one per tile a county crosses and only
    // the token layer thins them (`hideNamedCounties`), so with it down a landing repeated its
    // county four times around the record.
    if (map?.getLayer(EXPLORE_COUNTY_LABEL_LAYER_ID)) {
      map.setLayoutProperty(
        EXPLORE_COUNTY_LABEL_LAYER_ID,
        'visibility',
        shown && configRef.current.clusteringEnabled ? 'visible' : 'none',
      );
    }
    // The token layer lays out on `render` (place-labels.ts): ask for one so it catches up.
    if (shown) map?.triggerRepaint();
  }, []);
  /** The symbol layers `setMapLabels(false)` hid, with the visibility each had. */
  const hiddenLabelsRef = useRef<Map<string, 'visible' | 'none'> | null>(null);
  const setMapLabels = useCallback((shown: boolean) => {
    const map = mapRef.current;
    if (!map || shown === (hiddenLabelsRef.current === null)) return;
    if (shown) {
      for (const [id, visibility] of hiddenLabelsRef.current ?? []) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
      }
      hiddenLabelsRef.current = null;
      return;
    }
    const hidden = new Map<string, 'visible' | 'none'>();
    for (const layer of map.getStyle().layers) {
      if (layer.type !== 'symbol') continue;
      hidden.set(layer.id, layer.layout?.visibility === 'none' ? 'none' : 'visible');
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
    hiddenLabelsRef.current = hidden;
  }, []);
  /** The posture as of the last render, readable from the async mount path below. */
  const postureRef = useRef<PlatePosture>(posture);
  postureRef.current = posture;
  /** True while the plate is the Door's own Orbit, not its browse posture: lines wait for
   * `ORBIT_MAX_ZOOM` there (`applyOrbitLineFloor`). */
  const bareOrbit = posture === 'ambient' && !doorBrowseLive;
  const bareOrbitRef = useRef(bareOrbit);
  bareOrbitRef.current = bareOrbit;
  useEffect(() => {
    const map = mapRef.current;
    if (map?.isStyleLoaded()) applyOrbitLineFloor(map, configRef.current.style, bareOrbit);
  }, [bareOrbit]);
  /** The custom rotate gestures currently attached (`custom-rotate-gestures.ts`), or all null
   * when the posture has them detached. One ref, not three independent booleans, so the set
   * attaches and detaches together — see that module's doc comment for why they are one
   * capability. */
  const rotateGesturesRef = useRef<{
    shift: RotateGestureHandle | null;
    wheel: RotateGestureHandle | null;
    twist: RotateGestureHandle | null;
    /** iOS page-zoom guard (`attachSafariPageZoomGuard`), held while the map is full-screen. */
    pageZoom: RotateGestureHandle | null;
  }>({ shift: null, wheel: null, twist: null, pageZoom: null });
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreglRef = useRef<MaplibreModule['default'] | null>(null);
  /** `indexEntityPoints` of the current feature collection, rebuilt only when it changes. */
  const entityIndexRef = useRef<{
    readonly source: ExploreMapFeatureCollection['features'] | null;
    readonly byId: ReadonlyMap<string, EntityPoint>;
  }>({ source: null, byId: new Map() });
  const searchCenterMarkerRef = useRef<Marker | null>(null);
  const searchAreaRef = useRef<SearchAreaInput | null>(null);
  const listenersRef = useRef(makeListenerStore());
  const lastViewportRef = useRef<ExploreViewportFrame | undefined>(undefined);
  const [mapAvailable, setMapAvailable] = useState(true);
  const mapAvailableRef = useRef(true);
  // Published to every MapMoment through MapMomentStage, so a moment refuses LIVE rather than
  // going transparent under a tag that says the map is there.
  useReportMapAvailability(mapAvailable);
  /**
   * GL lifecycle, held in refs rather than closure locals because construction no longer happens
   * inside the effect that tears it down — `ensureMap` can fire from any handle call, while the
   * teardown still belongs to a single unmount effect.
   */
  const initStartedRef = useRef(false);
  const canceledRef = useRef(false);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const resizeLifecycleRef = useRef<ReturnType<typeof bindMapResizeLifecycle> | undefined>(
    undefined,
  );
  const contextRecoveryRef = useRef<ReturnType<typeof bindWebGlContextRecovery> | undefined>(
    undefined,
  );
  /** Camera flights requested before MapLibre finished constructing — flushed on `load`. */
  const pendingFlyRef = useRef<{
    readonly name: CameraPresetName;
    readonly target: CameraFlyTarget;
    readonly options?: MapStageFlyOptions;
  } | null>(null);

  // Seeded from the props when a surface supplied a server-built resting frame, and from nothing
  // when the root layout mounted the provider bare. `style` is built here rather than taken as a
  // given so the bare case still holds a valid style for the theme rebuild to work from.
  const configRef = useRef<StageConfig>({
    style:
      initialStyle ??
      buildExploreMapStyle({
        featureCollection: initialFeatureCollection ?? EMPTY_FEATURE_COLLECTION,
        jurisdictionAreaFeatures: initialJurisdictionAreaFeatures ?? [],
        layerMode: 'off',
      }),
    featureCollection: initialFeatureCollection ?? EMPTY_FEATURE_COLLECTION,
    ghostCollection: EMPTY_FEATURE_COLLECTION,
    jurisdictionAreaFeatures: initialJurisdictionAreaFeatures ?? [],
    layerMode: 'off',
    popGeo: DEFAULT_POPULATION_GEO,
    densityLevels: [],
    stateChoroplethLevels: [],
    countyChoroplethLevels: [],
    clusteringEnabled: true,
    satellite: false,
    historyEdgesEnabled: false,
    historyEdgeCollection: EMPTY_EDGE_COLLECTION,
    selectedState: undefined,
    selectedEdge: undefined,
    selectedEntity: undefined,
  });
  /** Bumps when a faded `patchData` starts so an in-flight dual-buffer crossdissolve can abort cleanly. */
  const decadeFadeGenerationRef = useRef(0);
  /** True while a dual-buffer morph is staging, dissolving, or promoting. */
  const decadeDissolveInFlightRef = useRef(false);
  /** Active rAF morph handle — canceled when a newer decade patch supersedes. */
  const decadeMorphAnimationRef = useRef<DecadeMorphAnimationHandle | null>(null);
  /** Settled per-state fill colors — colorA source for the next decade lerp. */
  const settledDensityFillByFipsRef = useRef<Map<string, string>>(new Map());
  /** Last in-flight density morph states — cleared on promote. */
  const activeDensityMorphRef = useRef<readonly DensityColorMorphState[]>([]);
  /*
   * The record ids on the plate BEFORE the config patch that triggered this morph, and the set
   * currently held still by it.
   *
   * `previousEntityIdsRef` is captured in the patch rather than at promote because by the time a
   * morph starts, `configRef.current.featureCollection` is already the incoming decade — the patch
   * is the only moment both sides exist.
   */
  const previousEntityIdsRef = useRef<readonly string[]>([]);
  const activeDecadeHoldRef = useRef<ReadonlySet<string>>(new Set());
  /**
   * Latches true on MapLibre `load`. Do NOT gate decade morphs on `isStyleLoaded()` —
   * GeoJSON setData / tile fetches flip that false and force the snap path (full refresh).
   */
  const mapStyleReadyRef = useRef(false);
  /** Latest apply options waiting for the style to settle — null when nothing is pending. */
  const pendingStyleApplyRef = useRef<Parameters<typeof applyStyleAndData>[0] | null>(null);
  /** Late-bound: `syncSearchArea` is declared after `applyStyleAndData`. */
  const syncSearchAreaRef = useRef<(() => void) | null>(null);
  /** True while a one-shot `idle` listener for a deferred apply is registered. */
  const pendingStyleApplyListenerRef = useRef(false);
  /** Stable handle so the deferred `idle` callback always runs the current apply closure. */
  const applyStyleAndDataRef = useRef<
    ((options?: Parameters<typeof applyStyleAndData>[0]) => void) | null
  >(null);
  const markMapUnavailable = useCallback(() => {
    if (!mapAvailableRef.current) return;
    mapAvailableRef.current = false;
    setMapAvailable(false);
    plateReadyRef.current = false;
    globeAskedRef.current = false;
    plateRef.current?.removeAttribute('data-plate-ready');
    notify(listenersRef.current, 'error');
  }, []);

  /** True once `data-plate-ready` is stamped; cleared only when the plate fails. */
  const plateReadyRef = useRef(false);
  /**
   * Reveal the plate: stamp `data-plate-ready` (the first-paint boards and the Door's cover key
   * their fade on it) and tell subscribers. Once per plate life — the three callers (first `idle`
   * after load, the 1800ms fallback, state polygons landing) race, and only the first counts.
   */
  /** True once the flat plate has been asked to become the globe (below). */
  const globeAskedRef = useRef(false);
  const markPlateReady = useCallback(() => {
    if (canceledRef.current || plateReadyRef.current) return;
    const reveal = () => {
      if (canceledRef.current || plateReadyRef.current) return;
      plateReadyRef.current = true;
      stampPlateReady(plateRef.current);
      notify(listenersRef.current, 'ready');
    };
    const map = mapRef.current;
    if (!map) {
      reveal();
      return;
    }
    // v11: a plate that opened flat (a record page; map-plate-paint.ts) becomes the globe here.
    // Near the ground the two projections draw the same picture, so it is revealed at once and
    // switched in idle time afterwards. Farther out the curve shows, so the switch comes first
    // and the reveal waits for the globe's frame. A plate that opened as the globe just reveals.
    if (globeAskedRef.current) return;
    globeAskedRef.current = true;
    if (map.getProjection()?.type === 'globe') {
      reveal();
      return;
    }
    const nearGround = map.getZoom() >= GLOBE_INVISIBLE_ZOOM;
    const toGlobe = () => {
      if (canceledRef.current) return;
      try {
        map.setProjection({ type: 'globe' });
      } catch {
        // The style is mid-load: ask again when it has settled.
        map.once('idle', toGlobe);
        return;
      }
      if (!nearGround) {
        map.once('idle', reveal);
        window.setTimeout(reveal, 1500);
      }
    };
    if (nearGround) reveal();
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(toGlobe, { timeout: nearGround ? 4000 : 600 });
    } else {
      window.setTimeout(toGlobe, nearGround ? 2000 : 0);
    }
  }, []);

  const entityPoint = useCallback((entityId: string): EntityPoint | undefined => {
    const features = configRef.current.featureCollection.features;
    if (entityIndexRef.current.source !== features) {
      entityIndexRef.current = { source: features, byId: indexEntityPoints(features) };
    }
    return entityIndexRef.current.byId.get(entityId);
  }, []);

  /** The callout on the selected pin (`selection-flag.ts`). */
  const selectionFlagRef = useRef<{ readonly id: string; readonly marker: Marker } | null>(null);
  /** Place tokens and site names in the house type (`place-labels.ts`). */
  const placeLabelsRef = useRef<PlaceLabelsHandle | null>(null);
  const syncSelectionFlag = useCallback(
    (map: MapLibreMap, entityId: string | undefined) => {
      const maplibregl = maplibreglRef.current;
      const at = entityId ? entityPoint(entityId) : undefined;
      placeLabelsRef.current?.setSelected(entityId, at ? [at.lng, at.lat] : undefined);
      if (selectionFlagRef.current?.id === entityId) return;
      selectionFlagRef.current?.marker.remove();
      selectionFlagRef.current = null;
      const point = entityId ? entityPoint(entityId) : undefined;
      if (!entityId || !point?.drawn || !maplibregl) return;
      const marker = new maplibregl.Marker({
        element: buildSelectionFlagElement(point.name, point.meta),
        anchor: 'bottom',
        // The leader starts above the grown pin (1.6 x 6px radius), not on its center.
        offset: [0, -12],
      })
        .setLngLat([point.lng, point.lat])
        .addTo(map);
      selectionFlagRef.current = { id: entityId, marker };
    },
    [entityPoint],
  );

  /**
   * Where a record's disc is on screen, for a photo card to anchor to. Only from the site level,
   * where records draw as individual discs (below it they are inside a place token), and only when
   * the disc is inside the map's box.
   */
  const entityHoverTarget = useCallback(
    (entityId: string) => {
      const map = mapRef.current;
      if (!map || map.getZoom() < SITE_MIN_ZOOM) return null;
      const point = entityPoint(entityId);
      if (!point) return null;
      const { x, y } = map.project([point.lng, point.lat]);
      const canvas = map.getCanvas();
      if (x < 0 || y < 0 || x > canvas.clientWidth || y > canvas.clientHeight) return null;
      const box = canvas.getBoundingClientRect();
      const half = ENTITY_ANCHOR_SIZE_PX / 2;
      return {
        entityId,
        name: point.name,
        rect: new DOMRect(
          box.left + x - half,
          box.top + y - half,
          ENTITY_ANCHOR_SIZE_PX,
          ENTITY_ANCHOR_SIZE_PX,
        ),
      };
    },
    [entityPoint],
  );

  const applyStyleAndData = useCallback(
    (options?: {
      readonly recreateEntitiesSource?: boolean;
      /**
       * Mid decade crossdissolve: keep opacity channels owned by the dissolve
       * while setData / paint sync runs so buffers stay continuous.
       */
      readonly preserveDecadeFadeOpacities?: boolean;
      /** Hold primary entities/edges while incoming buffers stage the next frame. */
      readonly deferPrimaryDecadeData?: boolean;
      /** Skip primary density load (incoming buffer stages density during dissolve). */
      readonly skipPrimaryDensityLoad?: boolean;
    }) => {
      const map = mapRef.current;
      if (!map) return;
      // Gate on the latched `load` flag, NOT `isStyleLoaded()` — that getter flips false during
      // routine GeoJSON/tile work (and can sit false indefinitely on slow tile hosts), which
      // silently dropped whole applies: layer-mode flips, filter patches, choropleth joins.
      if (!mapStyleReadyRef.current) {
        // Pre-`load` window: hold the latest requested options; the `load` handler re-applies.
        pendingStyleApplyRef.current = options ?? {};
        if (!pendingStyleApplyListenerRef.current) {
          pendingStyleApplyListenerRef.current = true;
          map.once('load', () => {
            pendingStyleApplyListenerRef.current = false;
            const pending = pendingStyleApplyRef.current;
            pendingStyleApplyRef.current = null;
            if (pending) applyStyleAndDataRef.current?.(pending);
          });
        }
        return;
      }
      pendingStyleApplyRef.current = null;
      try {
        // Geography layers stay mounted — in-place setData + paint/layout sync.
        // Remove/re-add was cheap CPU-wise but read as a full map refresh and
        // aborted MapLibre opacity transitions mid-decade.
        applyGeographyStyle(map, configRef.current.style, {
          ...(options?.recreateEntitiesSource ? { recreateEntitiesSource: true } : {}),
          ...(options?.preserveDecadeFadeOpacities ? { preserveDecadeFadeOpacities: true } : {}),
          ...(options?.deferPrimaryDecadeData ? { deferPrimaryDecadeData: true } : {}),
        });
        setSelectedStateFilter(map, configRef.current.selectedState);
        if (!options?.deferPrimaryDecadeData) {
          setHistoryEdgeData(map, configRef.current.historyEdgeCollection);
        }
        setHistoryEdgesVisibility(map, configRef.current.historyEdgesEnabled);
        setSelectedEdgeFilter(map, configRef.current.selectedEdge);
        setSelectedEntityFilter(map, configRef.current.selectedEntity);
        syncSelectionFlag(map, configRef.current.selectedEntity);
        if (!options?.skipPrimaryDensityLoad) {
          void loadStatePolygonsWithDensity(
            map,
            configRef.current.densityLevels,
            configRef.current.stateChoroplethLevels,
          )
            .then((joined) => {
              settledDensityFillByFipsRef.current = indexDensityFillColors(joined);
              if (joined.features.length > 0) markPlateReady();
            })
            .catch((error) => {
              console.error('[MapStage] state polygon load failed', error);
            });
        }
        requestCountyPolygonLoad(map, configRef.current);
        syncSearchAreaRef.current?.();
      } catch (error) {
        console.error('[MapStage] style/data apply failed', error);
      }
    },
    [syncSelectionFlag],
  );
  applyStyleAndDataRef.current = applyStyleAndData;

  const syncPlatePaintToTheme = useCallback((map: MapLibreMap, style: StyleSpecification) => {
    syncLayerPaintFromStyle(map, style, PERSISTENT_PLATE_LAYER_IDS, (update, error) => {
      console.error(
        `[MapStage] setPaintProperty ${update.layerId}.${update.paintKey} failed`,
        error,
      );
    });
  }, []);

  const commitDataPatch = useCallback(
    (
      patch: MapStageDataPatch,
      applyOptions?: Parameters<typeof applyStyleAndData>[0] & {
        /**
         * Decade morph: write config only — do not sync style/paint/visibility onto the
         * live map. A full applyGeographyStyle mid-morph reads as a map refresh and
         * aborts MapLibre opacity transitions (also trips on React StrictMode’s
         * double effect invoke via the old interrupt→snap path).
         */
        readonly configOnly?: boolean;
      },
    ) => {
      const clusteringEnabled = patch.clusteringEnabled ?? configRef.current.clusteringEnabled;
      const popGeo = patch.popGeo ?? configRef.current.popGeo;
      const satellite = patch.satellite ?? configRef.current.satellite;
      const ghostCollection = patch.ghostCollection ?? EMPTY_FEATURE_COLLECTION;
      const style = buildExploreMapStyle({
        featureCollection: patch.featureCollection,
        ghostCollection,
        jurisdictionAreaFeatures: patch.jurisdictionAreaFeatures,
        layerMode: patch.layerMode,
        popGeo,
        historyEdgesEnabled: patch.historyEdgesEnabled,
        clusteringEnabled,
        satellite,
        colorScheme: readDocumentColorScheme(),
      });
      previousEntityIdsRef.current = entityIdsInCollection(configRef.current.featureCollection);
      configRef.current = {
        ...configRef.current,
        style,
        featureCollection: patch.featureCollection,
        ghostCollection,
        jurisdictionAreaFeatures: patch.jurisdictionAreaFeatures,
        layerMode: patch.layerMode,
        popGeo,
        densityLevels: patch.densityLevels,
        stateChoroplethLevels: patch.stateChoroplethLevels ?? [],
        countyChoroplethLevels: patch.countyChoroplethLevels ?? [],
        clusteringEnabled,
        satellite,
        historyEdgesEnabled: patch.historyEdgesEnabled,
        historyEdgeCollection: patch.historyEdgeCollection,
      };
      if (applyOptions?.configOnly) {
        // Decade morph holds live style sync, but population choropleth joins still
        // must apply when the compact index arrives after the first paint.
        const map = mapRef.current;
        if (map && mapStyleReadyRef.current) {
          requestCountyPolygonLoad(map, configRef.current);
        }
        return;
      }
      const styleApplyOptions = applyOptions
        ? {
            ...(applyOptions.recreateEntitiesSource
              ? { recreateEntitiesSource: true as const }
              : {}),
            ...(applyOptions.preserveDecadeFadeOpacities
              ? { preserveDecadeFadeOpacities: true as const }
              : {}),
            ...(applyOptions.deferPrimaryDecadeData
              ? { deferPrimaryDecadeData: true as const }
              : {}),
            ...(applyOptions.skipPrimaryDensityLoad
              ? { skipPrimaryDensityLoad: true as const }
              : {}),
          }
        : undefined;
      applyStyleAndData(styleApplyOptions);
    },
    [applyStyleAndData],
  );

  const stageIncomingDecadeBuffers = useCallback(async (map: MapLibreMap): Promise<void> => {
    const cfg = configRef.current;
    const entitiesIncoming = map.getSource(EXPLORE_ENTITIES_INCOMING_SOURCE_ID) as
      GeoJSONSource | undefined;
    if (entitiesIncoming) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
      entitiesIncoming.setData(entitiesSourceData(cfg) as any);
      await waitForGeoJsonSourceData(map, EXPLORE_ENTITIES_INCOMING_SOURCE_ID);
      dropInIncomingPins(map);
    }
    // Pins leaving the brushed range become sand ghosts as the new frame arrives.
    const ghosts = map.getSource(EXPLORE_GHOSTS_SOURCE_ID) as GeoJSONSource | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
    ghosts?.setData(drawnRecordCollection(cfg.ghostCollection) as any);
    const edgesIncoming = map.getSource(EXPLORE_HISTORY_EDGES_INCOMING_SOURCE_ID) as
      GeoJSONSource | undefined;
    if (edgesIncoming) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
      edgesIncoming.setData(cfg.historyEdgeCollection as any);
    }
  }, []);

  const clearIncomingDecadeBuffers = useCallback((map: MapLibreMap): void => {
    for (const sourceId of [
      EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
      EXPLORE_HISTORY_EDGES_INCOMING_SOURCE_ID,
    ]) {
      const source = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (!source) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
      source.setData(EMPTY_FEATURE_COLLECTION as any);
    }
  }, []);

  const settleDensityColorMorph = useCallback(
    async (
      map: MapLibreMap,
      generation: number,
      morphStates: readonly DensityColorMorphState[],
    ): Promise<void> => {
      const cfg = configRef.current;
      try {
        const joined = await loadStatePolygonsWithDensity(
          map,
          cfg.densityLevels,
          cfg.stateChoroplethLevels,
        );
        if (generation !== decadeFadeGenerationRef.current) return;
        settledDensityFillByFipsRef.current = indexDensityFillColors(joined);
        clearDensityMorphFeatureState(map, morphStates);
        activeDensityMorphRef.current = [];
      } catch (error) {
        console.error('[MapStage] density color morph settle failed', error);
      }
    },
    [],
  );

  const promoteIncomingDecadeBuffers = useCallback(
    async (map: MapLibreMap, generation: number): Promise<void> => {
      const cfg = configRef.current;
      setDecadeCrossfadeTransitions(map, 0);
      // Release the held records before the buffers swap. A mark left behind would pin them at
      // rest through the NEXT decade's dissolve — the same shimmer inverted.
      clearDecadeHoldFeatureState(map, activeDecadeHoldRef.current);
      activeDecadeHoldRef.current = new Set();
      const entities = map.getSource(EXPLORE_ENTITIES_SOURCE_ID) as GeoJSONSource | undefined;
      if (entities) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
        entities.setData(entitiesSourceData(cfg) as any);
        setPlaceLeaderData(map, cfg);
        await waitForGeoJsonSourceData(map, EXPLORE_ENTITIES_SOURCE_ID);
      }
      if (generation !== decadeFadeGenerationRef.current) return;
      setHistoryEdgeData(map, cfg.historyEdgeCollection);
      if (generation !== decadeFadeGenerationRef.current) return;
      // Restore kind expressions (not constant rest opacities) so idle pins never stay in a
      // dual-buffer / uniform-lit paint state after decade morph.
      restoreDecadeFadePaintFromStyle(map, cfg.style);
      clearIncomingDecadeBuffers(map);
      setHistoryEdgesVisibility(map, cfg.historyEdgesEnabled);
    },
    [clearIncomingDecadeBuffers],
  );

  const runDecadeMorph = useCallback(
    (map: MapLibreMap, generation: number, durationMs: number) => {
      void (async () => {
        decadeMorphAnimationRef.current?.cancel();
        decadeMorphAnimationRef.current = null;

        setHistoryEdgesVisibility(map, true);
        let morphStates: readonly DensityColorMorphState[] = [];
        try {
          await stageIncomingDecadeBuffers(map);
          const cfg = configRef.current;
          const collection = await fetchStatePolygons();
          const nextJoined = joinDensityOntoStatePolygons(collection, cfg.densityLevels, {
            colorScheme: readDocumentColorScheme(),
          });
          morphStates = buildDensityColorMorphStates(
            settledDensityFillByFipsRef.current,
            nextJoined.features,
          );
          activeDensityMorphRef.current = morphStates;
          applyDensityBlendProgress(map, morphStates, 0);
          // Both buffers now hold data, so the marks can be written to each.
          const held = buildDecadeHoldSet(
            previousEntityIdsRef.current,
            entityIdsInCollection(cfg.featureCollection),
          );
          clearDecadeHoldFeatureState(map, activeDecadeHoldRef.current);
          applyDecadeHoldFeatureState(map, held);
          activeDecadeHoldRef.current = held;
        } catch (error) {
          console.error('[MapStage] incoming decade buffer stage failed', error);
          if (generation !== decadeFadeGenerationRef.current) return;
          decadeDissolveInFlightRef.current = false;
          applyStyleAndData();
          return;
        }
        if (generation !== decadeFadeGenerationRef.current) return;

        const animation = runDecadeMorphAnimation({
          map,
          durationMs,
          isCurrent: () => generation === decadeFadeGenerationRef.current,
          onProgress: (eased) => applyDensityBlendProgress(map, morphStates, eased),
          holdPersistingRecords: activeDecadeHoldRef.current.size > 0,
        });
        decadeMorphAnimationRef.current = animation;
        await animation.done;
        if (generation !== decadeFadeGenerationRef.current) return;
        decadeMorphAnimationRef.current = null;

        await settleDensityColorMorph(map, generation, morphStates);
        if (generation !== decadeFadeGenerationRef.current) return;
        await promoteIncomingDecadeBuffers(map, generation);
        if (generation === decadeFadeGenerationRef.current) {
          decadeDissolveInFlightRef.current = false;
        }
      })();
    },
    [
      applyStyleAndData,
      promoteIncomingDecadeBuffers,
      settleDensityColorMorph,
      stageIncomingDecadeBuffers,
    ],
  );

  const patchData = useCallback(
    (patch: MapStageDataPatch, options?: MapStageDataPatchOptions) => {
      const clusteringEnabled = patch.clusteringEnabled ?? configRef.current.clusteringEnabled;
      const clusteringChanged = clusteringEnabled !== configRef.current.clusteringEnabled;
      // Population choropleth visibility + fill-color expressions live in style layout/paint.
      // Decade morph is configOnly and never syncs those — a layerMode change must full-apply.
      const layerModeChanged = patch.layerMode !== configRef.current.layerMode;
      const popGeoChanged = (patch.popGeo ?? configRef.current.popGeo) !== configRef.current.popGeo;
      const recreate = clusteringChanged ? ({ recreateEntitiesSource: true } as const) : undefined;
      const wantsFade = options?.fade === true && !prefersReducedMotion();
      const map = mapRef.current;
      // Morph when the dual-buffer layers exist. `isStyleLoaded()` is the wrong gate —
      // it goes false during routine GeoJSON/tile work and was forcing a hard snap
      // on every decade advance (the “full refresh” the eye sees).
      const morphLayersReady = Boolean(
        map &&
        mapStyleReadyRef.current &&
        map.getLayer(EXPLORE_STATE_DENSITY_LAYER_ID) &&
        map.getLayer(EXPLORE_UNCLUSTERED_POINT_LAYER_ID) &&
        map.getLayer(EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID),
      );

      if (
        !wantsFade ||
        !map ||
        !morphLayersReady ||
        clusteringChanged ||
        layerModeChanged ||
        popGeoChanged
      ) {
        // Invalidate any in-flight decade morph so a later timeout cannot overwrite this snap.
        decadeFadeGenerationRef.current += 1;
        decadeDissolveInFlightRef.current = false;
        decadeMorphAnimationRef.current?.cancel();
        decadeMorphAnimationRef.current = null;
        if (map && activeDensityMorphRef.current.length > 0) {
          clearDensityMorphFeatureState(map, activeDensityMorphRef.current);
          activeDensityMorphRef.current = [];
        }
        // Drop mid-morph dual-buffer pin paint/data before the snap apply — otherwise a
        // canceled dissolve can leave every entity in a partial-lit incoming stack.
        if (map && mapStyleReadyRef.current) {
          setDecadeCrossfadeTransitions(map, 0);
          restoreDecadeFadePaintFromStyle(map, configRef.current.style);
          clearIncomingDecadeBuffers(map);
        }
        commitDataPatch(patch, recreate);
        return;
      }

      const generation = ++decadeFadeGenerationRef.current;
      const durationMs = DECADE_LAYER_FADE_MS;
      decadeDissolveInFlightRef.current = true;
      decadeMorphAnimationRef.current?.cancel();
      decadeMorphAnimationRef.current = null;

      // Config only — never paint-sync the live style mid-morph (that was the full refresh).
      // Superseding an in-flight morph (including React StrictMode’s double effect) restages
      // incoming and restarts the dissolve; it must not snap primary sources.
      commitDataPatch(patch, { configOnly: true });
      runDecadeMorph(map, generation, durationMs);
    },
    [clearIncomingDecadeBuffers, commitDataPatch, runDecadeMorph],
  );

  useEffect(() => {
    const syncPlateToTheme = () => {
      const map = mapRef.current;
      if (!map) return;
      // isStyleLoaded() is false while any tile is still loading; a switch made then would be
      // dropped and leave the plate in the other theme, so wait for the map to settle.
      if (!map.isStyleLoaded()) {
        map.once('idle', syncPlateToTheme);
        return;
      }
      const cfg = configRef.current;
      const scheme = readDocumentColorScheme();
      const style = buildStyleForScheme(cfg, scheme);
      configRef.current = { ...cfg, style };
      applyStyleAndData();
      syncPlatePaintToTheme(map, style);
    };
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.attributeName === 'data-theme')) {
        syncPlateToTheme();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, [applyStyleAndData, syncPlatePaintToTheme]);

  const applyViewState = useCallback(
    (patch: MapStageViewPatch) => {
      configRef.current = {
        ...configRef.current,
        selectedState: patch.selectedState,
        selectedEdge: patch.selectedEdge,
        selectedEntity: patch.selectedEntity,
      };
      const map = mapRef.current;
      if (!map) return;
      const apply = () => {
        const { selectedState, selectedEdge, selectedEntity } = configRef.current;
        setSelectedStateFilter(map, selectedState);
        placeLabelsRef.current?.setSelectedPlace(
          selectedState ? `state-${selectedState.toLowerCase()}` : undefined,
        );
        setSelectedEdgeFilter(map, selectedEdge);
        setSelectedEntityFilter(map, selectedEntity);
        syncSelectionFlag(map, selectedEntity);
      };
      // Apply now: each setter skips a layer the style does not have yet, and a layer that is
      // there takes a filter whether or not tiles are still loading. Waiting for the map to
      // settle held the mark back for a whole flight, and for a whole scrubbed dive on home,
      // where the map never settles until the scroll rests: the ring arrived after the camera.
      apply();
      // A selection made while sources are still loading (the home hand-off lands mid-flight,
      // as the catalog replaces the first-paint pins) used to be dropped, leaving the record
      // framed with no copper mark. Apply it again once the map settles, reading the latest
      // selection then.
      if (!map.isStyleLoaded()) map.once('idle', apply);
    },
    [syncSelectionFlag],
  );

  const runFlyPreset = useCallback(
    (name: CameraPresetName, target: CameraFlyTarget, options?: MapStageFlyOptions) =>
      runFlyPresetOnMap(mapRef.current, name, target, options),
    [],
  );

  const flyPreset = useCallback(
    (name: CameraPresetName, target: CameraFlyTarget, options?: MapStageFlyOptions) => {
      if (runFlyPreset(name, target, options)) {
        pendingFlyRef.current = null;
        return;
      }
      // MapLibre is still constructing (common on locate → explore remount). Keep the latest
      // request and apply it once the canvas fires `load`.
      pendingFlyRef.current = { name, target, ...(options ? { options } : {}) };
    },
    [runFlyPreset],
  );

  const clearSearchCenterMarker = useCallback(() => {
    searchCenterMarkerRef.current?.remove();
    searchCenterMarkerRef.current = null;
  }, []);

  const resize = useCallback(() => {
    try {
      const map = mapRef.current;
      if (map) resizeMapInPlace(map);
    } catch (error) {
      console.error('[MapStage] resize failed', error);
    }
  }, []);

  /**
   * Attaches or detaches Shift+drag and Safari two-finger-twist rotate to match the posture's
   * `dragRotate` state, exactly as `applyGesturesForPosture` does for MapLibre's own handlers.
   * Called from every site that calls `applyGesturesForPosture` — paired the same way that
   * function's own doc comment pairs `lockGestures`/`unlockGestures`, so these cannot drift
   * out of sync with native rotate and go on answering a posture that no longer steers.
   */
  const syncRotateGestures = useCallback(
    (map: MapLibreMap, posture: PlatePosture, pointerFine: boolean) => {
      // The plate is aria-hidden, so its canvas is a Tab stop only where the reader steers it
      // (live); a backdrop or framed map would be a focus stop that announces nothing.
      map.getCanvas().tabIndex = posture === 'live' ? 0 : -1;
      const container = containerRef.current;
      const current = rotateGesturesRef.current;
      const allowed = container !== null && rotateGestureAllowed(posture, { pointerFine });
      if (allowed && !current.shift) {
        current.shift = attachShiftDragRotate(map, container);
        current.wheel = attachShiftWheelRotate(map, container);
        current.twist = attachSafariTwistRotate(map, container);
      } else if (!allowed && current.shift) {
        current.shift.detach();
        current.wheel?.detach();
        current.twist?.detach();
        current.shift = null;
        current.wheel = null;
        current.twist = null;
      }
      // A full-screen map owns every two-finger gesture on it; on iOS that includes cancelling
      // Safari's page zoom, which MapLibre does not do (`attachSafariPageZoomGuard`).
      const fullScreen =
        container !== null && gesturePolicyFor(posture, { pointerFine }) === 'reader';
      if (fullScreen && !current.pageZoom) current.pageZoom = attachSafariPageZoomGuard(container);
      else if (!fullScreen && current.pageZoom) {
        current.pageZoom.detach();
        current.pageZoom = null;
      }
      // Pinch is zoom only on a touch screen. This is a north-up history map: a pinch that also
      // twists the country by a few degrees is the most common accidental gesture on mobile
      // maps. Rotation stays one deliberate step away in the View panel's compass; desktop keeps
      // its rotate paths.
      if (pointerFine) map.touchZoomRotate.enableRotation();
      else map.touchZoomRotate.disableRotation();
    },
    [],
  );

  const setSearchCenterMarker = useCallback(
    (marker: ExploreSearchCenterMarkerInput) => {
      const map = mapRef.current;
      const maplibregl = maplibreglRef.current;
      if (!map || !maplibregl) return;
      clearSearchCenterMarker();
      try {
        const element = buildExploreSearchCenterMarkerElement(marker.label, marker.variant);
        // The you-are-here dot is centred on the fix (as the accuracy circle is); a place pin
        // stands on its point.
        const anchor = marker.variant === 'user' ? 'center' : 'bottom';
        searchCenterMarkerRef.current = new maplibregl.Marker({ element, anchor })
          .setLngLat([marker.lng, marker.lat])
          .addTo(map);
      } catch (error) {
        console.error('[MapStage] search center marker failed', error);
      }
    },
    [clearSearchCenterMarker],
  );

  /**
   * Mounts (once) and fills the search-area source. Called on every set and after every style
   * apply, so a theme flip or style rebuild cannot silently drop the circle.
   */
  const syncSearchArea = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapStyleReadyRef.current) return;
    try {
      const data = searchAreaCollection(searchAreaRef.current);
      const source = map.getSource(SEARCH_AREA_SOURCE) as
        { setData: (data: unknown) => void } | undefined;
      if (source) {
        source.setData(data);
      } else {
        map.addSource(SEARCH_AREA_SOURCE, { type: 'geojson', data } as never);
      }
      const accent =
        (typeof document !== 'undefined' &&
          getComputedStyle(document.documentElement)
            .getPropertyValue('--ds-accent-graphic')
            .trim()) ||
        '#C48A4A';
      if (!map.getLayer(SEARCH_AREA_FILL)) {
        map.addLayer({
          id: SEARCH_AREA_FILL,
          type: 'fill',
          source: SEARCH_AREA_SOURCE,
          paint: {
            'fill-color': accent,
            'fill-opacity': ['match', ['get', 'role'], 'accuracy', 0.16, 0.07],
          },
        } as never);
      }
      if (!map.getLayer(SEARCH_AREA_LINE)) {
        map.addLayer({
          id: SEARCH_AREA_LINE,
          type: 'line',
          source: SEARCH_AREA_SOURCE,
          filter: ['==', ['get', 'role'], 'radius'],
          paint: {
            'line-color': accent,
            'line-width': 1.5,
            'line-opacity': 0.7,
            'line-dasharray': [3, 2],
          },
        } as never);
      }
      // A theme switch re-runs this with the layers already added: repaint them in the new accent.
      map.setPaintProperty(SEARCH_AREA_FILL, 'fill-color', accent);
      map.setPaintProperty(SEARCH_AREA_LINE, 'line-color', accent);
    } catch (error) {
      console.error('[MapStage] search area sync failed', error);
    }
  }, []);

  syncSearchAreaRef.current = syncSearchArea;

  const setSearchArea = useCallback(
    (area: SearchAreaInput | null) => {
      searchAreaRef.current = area;
      syncSearchArea();
    },
    [syncSearchArea],
  );

  /** Stable handle for one-shot map listeners (cluster expand) registered in the mount effect. */
  const runFlyPresetRef = useRef(runFlyPreset);
  runFlyPresetRef.current = runFlyPreset;

  const subscribe = useCallback(
    <E extends MapStageEventName>(
      event: E,
      handler: (...args: MapStageEvents[E]) => void,
    ): (() => void) => {
      const set = listenersRef.current[event];
      set.add(handler);
      // Latch: replay the most recent value to a subscriber that attaches after the fact — the
      // stage may already be alive with state from a page that mounted earlier this session.
      if (event === 'error' && !mapAvailableRef.current) {
        (handler as () => void)();
      }
      if (event === 'viewport' && lastViewportRef.current) {
        (handler as (viewport: ExploreViewportFrame) => void)(lastViewportRef.current);
      }
      if (event === 'ready' && plateReadyRef.current) {
        (handler as () => void)();
      }
      return () => {
        set.delete(handler);
      };
    },
    [],
  );

  /**
   * Build the MapLibre instance, once, on first contact with the stage handle.
   *
   * The provider mounts on every surface so the plate can persist across navigation, but a
   * Utility surface has no plate — the parked posture promises no GL cost there, and a provider
   * that constructed MapLibre on mount would break that promise on `/privacy`. Construction is
   * therefore deferred to the first `patchData`/`flyPreset`/`applyViewState`/`getMap`/`resize`
   * call, which is exactly the set of things a surface that wants a plate does and a surface
   * that does not want one never does. The rule needs no registry: GL exists when, and only
   * when, a surface has spoken to the stage.
   */
  const ensureMap = useCallback(() => {
    if (initStartedRef.current || canceledRef.current) return;
    if (!containerRef.current || mapRef.current) return;
    initStartedRef.current = true;
    const container = containerRef.current;

    void (async () => {
      let map: MapLibreMap | undefined;
      try {
        if (!isWebGlAvailable()) {
          throw new Error('WebGL unavailable');
        }
        const maplibregl = (await import('maplibre-gl')).default;
        maplibreglRef.current = maplibregl;
        // Two imports can be in flight at once (StrictMode re-runs the surface's first patch
        // after the re-arm above); whichever resolves second must not build a second map into
        // the same container.
        if (canceledRef.current || !container.isConnected || mapRef.current) return;

        // The style prop was built on the server, which cannot read `<html data-theme>`. Re-resolve
        // the plate against the document BEFORE the first frame so a light-theme reader never sees
        // the dark plate — neither in the pre-`load` background nor in the first `applyStyleAndData`.
        const mountScheme = readDocumentColorScheme();
        configRef.current = {
          ...configRef.current,
          style: buildStyleForScheme(configRef.current, mountScheme),
        };

        map = new maplibregl.Map({
          container,
          // The Door and Explore open on the globe; a record page opens near the ground, flat.
          style: buildArchiveBaseStyle(
            mountScheme,
            postureRef.current === 'ambient' || postureRef.current === 'live',
          ),
          attributionControl: false,
          clickTolerance: MAP_CLICK_TOLERANCE_PX,
          // v11: the plate is a globe, which has no world copies to render. `false` here made
          // MapLibre clamp a world-scale center to keep the Mercator map's edge off screen, both
          // before the globe style loaded and on any flight that crossed the globe-to-Mercator
          // handover, so the Door's Orbit landed over the Atlantic.
          // Street-level context is available (OpenFreeMap roads from z8); stop short of
          // address-level invasion — precision redaction still governs marker honesty.
          minZoom: MAP_MIN_ZOOM,
          maxZoom: MAP_MAX_ZOOM,
          // The national frame is the resting camera for every surface, so a provider mounted
          // without a `bounds` prop opens on the same view rather than on MapLibre's [0,0].
          bounds: (bounds ?? US_CONUS_BOUNDS) as [number, number, number, number],
          fitBoundsOptions: { padding: PLATE_OPENING_PADDING_PX },
        });

        mapRef.current = map;
        // v11 Orbit: below the national frame the plate shows lights, not place tokens. The
        // tokens are DOM, so the plate says which altitude it is at and shell.css hides them.
        const orbitMap = map;
        const syncOrbit = () =>
          plateRef.current?.toggleAttribute('data-orbit', orbitMap.getZoom() < ORBIT_MAX_ZOOM);
        orbitMap.on('zoom', syncOrbit);
        orbitMap.on('load', syncOrbit);
        placeLabelsRef.current = bindPlaceLabels(map);
        placeLabelsRef.current.setSelectedPlace(
          configRef.current.selectedState
            ? `state-${configRef.current.selectedState.toLowerCase()}`
            : undefined,
        );
        if (process.env.NODE_ENV !== 'production') {
          // Dev-only escape hatch for in-browser inspection and perf traces.
          (window as unknown as Record<string, unknown>).__bpMapStage = map;
        }
        // No `NavigationControl`. Zoom and pitch live in the Explore camera console, so the map
        // keeps one control vocabulary (design-direction-v9-atlas.md §5.5). Attribution stays:
        // it is a license obligation, not chrome we get to choose.
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
        // Compact attribution opens itself the first time its text arrives. It is a license
        // obligation, so it stays one tap away, but as one collapsed "i", not a box on the map.
        // The control turns compact only once its text arrives, on a style or a source event.
        const collapseAttribution = () => {
          // Wait for the text: collapsing the still-empty control lets it open again on arrival.
          const attribution = container.querySelector(
            '.maplibregl-ctrl-attrib.maplibregl-compact:not(.maplibregl-attrib-empty)',
          );
          if (!attribution) return;
          attribution.classList.remove('maplibregl-compact-show');
          attribution.removeAttribute('open');
          map?.off('styledata', collapseAttribution);
          map?.off('sourcedata', collapseAttribution);
        };
        map.on('styledata', collapseAttribution);
        map.on('sourcedata', collapseAttribution);
        // A theme switch or a patch can put layers back at the style's own floor.
        map.on('styledata', () => {
          if (map) applyOrbitLineFloor(map, configRef.current.style, bareOrbitRef.current);
        });
        map.on('error', (event) => {
          console.error('[MapStage]', event.error);
        });
      } catch {
        if (!canceledRef.current) markMapUnavailable();
        return;
      }

      if (canceledRef.current || !map) {
        map?.remove();
        mapRef.current = null;
        return;
      }

      const activeMap = map;

      // MapLibre constructs with every gesture on. Only Live starts fully steered; a plate built
      // on the Door (ambient) hands back drag/zoom-adjust on a precise pointer only, and one built
      // into a moment (framed) starts fully locked — either way, the first wheel over the map
      // must still scroll the document that asked for it.
      applyGesturesForPosture(activeMap, postureRef.current, { pointerFine: prefersFinePointer() });
      syncRotateGestures(activeMap, postureRef.current, prefersFinePointer());

      lastViewportRef.current = readViewport(activeMap);
      notify(listenersRef.current, 'viewport', lastViewportRef.current);

      /**
       * National discs are a few pixels; query a padded box so a near-miss still opens
       * the record sheet instead of selecting the state fill underneath.
       */
      function pointerHitAt(point: { x: number; y: number }) {
        if (!ENTITY_POINTER_HIT_LAYER_IDS.some((id) => activeMap.getLayer(id))) return undefined;
        const features = queryRenderedLayers<MapLibreNamespace.MapGeoJSONFeature>(
          activeMap,
          pointerHitBox(point),
          ENTITY_POINTER_HIT_LAYER_IDS,
        );
        return resolveEntityPointerHit(
          features.map((feature) => ({
            layerId: feature.layer.id,
            properties: feature.properties ?? null,
            ...(feature.geometry.type === 'Point'
              ? { coordinates: feature.geometry.coordinates }
              : {}),
          })),
        );
      }

      /** A place token opens its place: the camera closes in to the next level, and the surface
       * (Explore) scopes its list to the place. Never opens a record. A surface that listens for
       * `placeSelect` owns the move (it knows the chrome the place must clear); otherwise the
       * stage closes in itself. */
      function drillIntoPlace(
        hit: Extract<NonNullable<ReturnType<typeof pointerHitAt>>, { kind: 'place' }>,
      ): void {
        notify(listenersRef.current, 'deselect');
        if (listenersRef.current.placeSelect.size > 0) {
          notify(listenersRef.current, 'placeSelect', hit.placeKey, {
            level: hit.level,
            bounds: hit.bounds,
            ...(hit.openZoom === undefined ? {} : { openZoom: hit.openZoom }),
          });
          return;
        }
        const [west, south, east, north] = hit.bounds;
        // Not `fitBoundsCamera`: this move lands on the fitted center with the camera's held
        // padding still on it, so the fit has to be computed against that padding too.
        let framed: ReturnType<typeof activeMap.cameraForBounds>;
        try {
          framed = activeMap.cameraForBounds(
            [
              [west, south],
              [east, north],
            ],
            { padding: 48 },
          );
        } catch {
          // MapLibre's globe throws when the paddings leave no canvas; the fallback frame below.
        }
        activeMap.easeTo({
          center: framed?.center ?? [(west + east) / 2, (south + north) / 2],
          zoom: placeDrillZoom(hit.level, framed?.zoom, MAP_MAX_ZOOM, hit.openZoom),
          duration: prefersReducedMotion() ? 0 : 420,
          easing: CAMERA_EASING_SLOW_OUT,
        });
        notify(listenersRef.current, 'placeSelect', hit.placeKey);
      }

      function handleEntityPointerHit(hit: NonNullable<ReturnType<typeof pointerHitAt>>): void {
        // Overlapping records always open a chooser, on every posture: picking the first would
        // open a record the reader may not have meant.
        if (hit.kind === 'overlap') {
          notify(listenersRef.current, 'overlap', hit.entityIds);
          return;
        }
        if (hit.kind === 'entity') {
          notify(listenersRef.current, 'select', hit.entityId);
          return;
        }
        drillIntoPlace(hit);
      }

      function handleEntityPointerClick(event: MapMouseEvent) {
        const hit = pointerHitAt(event.point);
        if (!hit) return;
        handleEntityPointerHit(hit);
      }

      activeMap.once('load', () => {
        mapStyleReadyRef.current = true;
        applyStyleAndData();
        // Hide the Albers locator once the live plate has painted so camera moves and
        // uncovered pin/cluster clicks hit MapLibre, not the underlay.
        activeMap.once('idle', markPlateReady);
        window.setTimeout(markPlateReady, 1800);
        const canvas = activeMap.getCanvas();
        contextRecoveryRef.current = bindWebGlContextRecovery(
          canvas,
          () => {
            if (!canceledRef.current) markMapUnavailable();
          },
          () => {
            if (!canceledRef.current) resizeMapInPlace(activeMap);
          },
        );
        bindPlateClickListeners(activeMap, {
          pointerHitAt,
          onEntityPointerClick: handleEntityPointerClick,
          onStateSelect: (postalCode) => notify(listenersRef.current, 'stateSelect', postalCode),
          onEdgeSelect: (edgeId) => notify(listenersRef.current, 'edgeSelect', edgeId),
          onActivate: (viewport) => notify(listenersRef.current, 'activate', viewport),
        });
        resizeMapInPlace(activeMap);
        // Flush camera requested while the canvas was still constructing (e.g. locate → explore
        // deep link with radius bounds). Prefer the pending flight over the constructor CONUS frame.
        const pending = pendingFlyRef.current;
        if (pending) {
          pendingFlyRef.current = null;
          runFlyPreset(pending.name, pending.target, pending.options);
        }
      });

      bindPlateCameraListeners(activeMap, {
        publishViewport: (viewport) => {
          lastViewportRef.current = viewport;
          notify(listenersRef.current, 'viewport', viewport);
        },
        onZoomSettled: () => {
          requestCountyPolygonLoad(activeMap, configRef.current);
        },
        publishBearing: (bearing) => notify(listenersRef.current, 'rotate', bearing),
        onUserInteract: () => {
          // Steering the map means the reader is done typing: drop the keyboard (and with it any
          // field's suggestion list) so the map they are moving is not half-covered by it.
          const active = document.activeElement;
          if (
            active instanceof HTMLElement &&
            (active instanceof HTMLInputElement ||
              active instanceof HTMLTextAreaElement ||
              active.isContentEditable)
          ) {
            active.blur();
          }
          notify(listenersRef.current, 'interact');
        },
      });

      /*
       * Pin hover, from the map's own hit test. Records used to be HTML buttons past cluster max
       * zoom, each with its own mouseenter/mouseleave; the map draws them now, so hover comes
       * from the same padded `queryRenderedFeatures` box that selection and the cursor use.
       * A short intent delay on the way in, none on the way out (`PinPhotoCard`'s contract).
       */
      let hoverWanted: string | null = null;
      /** The pin drawn lifted under the pointer (`setHoveredEntityFilter`). */
      let liftedPin: string | undefined;
      let hoverShown = false;
      let hoverTimer: ReturnType<typeof setTimeout> | null = null;
      const hoverTo = (entityId: string | null) => {
        if (entityId === hoverWanted) return;
        hoverWanted = entityId;
        if (hoverTimer !== null) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
        if (hoverShown) {
          hoverShown = false;
          notify(listenersRef.current, 'pinHover', null);
        }
        if (entityId === null) return;
        hoverTimer = setTimeout(() => {
          hoverTimer = null;
          if (hoverWanted !== entityId) return;
          const target = entityHoverTarget(entityId);
          if (!target) return;
          hoverShown = true;
          notify(listenersRef.current, 'pinHover', target);
        }, PIN_HOVER_INTENT_MS);
      };

      // Cursor affordance uses the same padded hit as selection so a near-miss still
      // reads as a pin, not empty plate.
      activeMap.on('mousemove', (event: MapMouseEvent) => {
        const hit = pointerHitAt(event.point);
        activeMap.getCanvas().style.cursor = hit ? 'pointer' : '';
        placeLabelsRef.current?.setHovered(hit?.kind === 'place' ? hit.placeKey : undefined);
        const lifted = hit?.kind === 'entity' ? hit.entityId : undefined;
        if (lifted !== liftedPin) {
          liftedPin = lifted;
          setHoveredEntityFilter(activeMap, lifted);
        }
        hoverTo(
          hit?.kind === 'entity' && activeMap.getZoom() >= SITE_MIN_ZOOM ? hit.entityId : null,
        );
      });
      activeMap.getCanvas().addEventListener('mouseleave', () => {
        hoverTo(null);
        placeLabelsRef.current?.setHovered(undefined);
        liftedPin = undefined;
        setHoveredEntityFilter(activeMap, undefined);
      });
      // The card is placed once, beside the disc; once the camera moves the disc is elsewhere.
      activeMap.on('movestart', () => hoverTo(null));

      resizeLifecycleRef.current = bindMapResizeLifecycle(container, () => {
        resizeMapInPlace(activeMap);
      });
      resizeTimerRef.current = setTimeout(() => {
        resizeMapInPlace(activeMap);
      }, 200);
    })();
    // Deliberately no deps: this builds the app's single MapLibre instance, and the guard above
    // makes a second call a no-op. Teardown is the separate unmount effect below, because
    // construction is now demand-driven and can happen long after mount.
  }, []);

  useEffect(() => {
    /*
     * Re-arm on (re)mount. React StrictMode runs this effect, its cleanup, then the effect again
     * on the same instance in development, and the refs survive that round trip. Without this
     * reset the simulated unmount below left `canceledRef` true for the life of the page: the
     * first `patchData` had already started the `maplibre-gl` import, the import resolved into a
     * canceled provider and returned, and no later call could retry because `initStartedRef`
     * was still set. The chunk loaded, the plate never built, and every dev session showed the
     * Albers underlay in place of the map — a failure invisible in production, where StrictMode
     * does not double-invoke.
     */
    canceledRef.current = false;
    initStartedRef.current = false;
    return () => {
      canceledRef.current = true;
      pendingFlyRef.current = null;
      decadeFadeGenerationRef.current += 1;
      decadeDissolveInFlightRef.current = false;
      decadeMorphAnimationRef.current?.cancel();
      decadeMorphAnimationRef.current = null;
      mapStyleReadyRef.current = false;
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeLifecycleRef.current?.disconnect();
      contextRecoveryRef.current?.disconnect();
      clearSearchCenterMarker();
      rotateGesturesRef.current.shift?.detach();
      rotateGesturesRef.current.wheel?.detach();
      rotateGesturesRef.current.twist?.detach();
      rotateGesturesRef.current.pageZoom?.detach();
      rotateGesturesRef.current = { shift: null, wheel: null, twist: null, pageZoom: null };
      placeLabelsRef.current?.dispose();
      placeLabelsRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreglRef.current = null;
    };
    // Empty deps, deliberately: this must run exactly once for the app's lifetime. The root
    // layout renders `MapStageProvider` above every route, so it never remounts on navigation —
    // that persistence IS the point, and it is what keeps the WebGL context, style and camera
    // alive between surfaces. Nothing here may re-run on a prop change.
  }, []);

  /** Stable across renders: the ref is the identity, not the map it currently holds. */
  const getMap = useCallback(() => mapRef.current as unknown as AtlasCameraTarget | null, []);

  /* —— The Framed posture ————————————————————————————————————————————————————————
     This is the seam `components/room/MapMoment.tsx` documents and SP-08 owes it: the stage
     publishes which moment is live and where its slot is, and the plate moves into that slot
     rather than a second MapLibre instance being built inside the document.

     It lives here, in the provider, because it is the only place that holds all three things it
     needs at once — the plate element, the GL instance, and the surface class. */

  /**
   * Reset to the resting posture on navigation, and hand back any slot still held.
   *
   * Without the release, a chapter's moment that held the slot when the reader clicked through
   * would keep holding it on the next route: React unmounts the outgoing tree AFTER mounting the
   * incoming one, so the moment's own cleanup cannot be relied on to run before the new page's
   * first claim. The registry's id-checked release makes the double-release safe.
   */
  useEffect(() => {
    const held = heldSlotRef.current;
    if (held !== null) {
      framedSlotsRef.current.release(held);
      heldSlotRef.current = null;
    }
    lastFramedMomentRef.current = null;
    if (doorBrowseLiveRef.current) {
      setPosture('live');
      return;
    }
    setPosture(defaultPostureFor(surfaceClass));
  }, [surfaceClass]);

  useEffect(() => {
    if (doorBrowseLive) {
      setPosture('live');
      return;
    }
    setPosture(defaultPostureFor(surfaceClass));
  }, [doorBrowseLive, surfaceClass]);

  /**
   * Posture changes reach the gesture handlers directly. The Framed path below does the same
   * inside its scroll-frame callback, but that callback only runs while a moment is live; a
   * route change from the Instrument to the Door (or back) has no moment and still has to hand
   * the wheel over.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyGesturesForPosture(map, posture, { pointerFine: prefersFinePointer() });
    syncRotateGestures(map, posture, prefersFinePointer());
    // The Door's phone strip may have sunk the zoom floor below the Instrument's national floor
    // (camera.ts, `zoomFloor: 'fit'`); every other posture gets the floor back. Live keeps a floor
    // no higher than the zoom it inherits: browse entered from the Door on a phone starts from the
    // whole-country fit, and clamping that to the national floor around the same center crops
    // both coasts.
    if (posture === 'live') map.setMinZoom(Math.min(MAP_MIN_ZOOM, map.getZoom()));
    else if (posture !== 'ambient') map.setMinZoom(MAP_MIN_ZOOM);
  }, [posture, syncRotateGestures]);

  /** A live read of the reduced-motion preference for the camera path below. */
  useEffect(() => {
    const listener = createReducedMotionListener();
    reducedMotionRef.current = listener;
    return () => {
      listener.disconnect();
      reducedMotionRef.current = null;
    };
  }, []);

  /**
   * Move the plate into the live moment's slot.
   *
   * Runs inside `MapMomentStage`'s rAF callback on every scroll frame while a moment is live, so
   * everything here is either a cheap write or guarded by a change check. Two guards matter:
   *
   *  - `setPosture` only fires on an actual transition. Calling it unconditionally would re-render
   *    the entire subtree under the plate sixty times a second to set an attribute to the value it
   *    already had.
   *  - the camera moves only when the LIVE MOMENT changes, not when its rect does. Re-flying on
   *    every frame would restart the animation continuously and the camera would never arrive.
   */
  useMapMomentFrame((frame) => {
    const plate = plateRef.current;
    if (!plate) return;

    if (!mapAvailable) return;

    const claimGranted =
      frame !== null && framedClaimAllowed(surfaceClass) && framedSlotsRef.current.claim(frame.id);
    if (claimGranted && frame !== null) heldSlotRef.current = frame.id;

    // Door browse hands the plate to the reader. This per-frame resolver used to ignore that and
    // put the Door's `ambient` posture back on every frame — on a touch screen that is a full
    // gesture lock, so /explore on a phone could not be dragged or pinched at all.
    const next = doorBrowseLiveRef.current
      ? 'live'
      : resolvePlatePosture({
          surface: surfaceClass,
          hasLiveMoment: frame !== null,
          claimGranted,
        });

    if (next !== 'framed') {
      const held = heldSlotRef.current;
      if (held !== null) {
        framedSlotsRef.current.release(held);
        heldSlotRef.current = null;
      }
      lastFramedMomentRef.current = null;
      lastFramedBoxRef.current = null;
      releasePlateSlot(plate);
      // Leaving Framed goes to Live (Instrument, fully steered), Ambient (Door, drag/zoom-adjust
      // on a precise pointer) or Parked (locked, so an unpainted plate cannot be reached by the
      // keyboard) — never back to Framed itself, which the block above already returned out of.
      const map = mapRef.current;
      if (map) {
        applyGesturesForPosture(map, next, { pointerFine: prefersFinePointer() });
        syncRotateGestures(map, next, prefersFinePointer());
      }
      setPosture((current) => (current === next ? current : next));
      return;
    }

    if (frame === null) return;
    // Document space, not viewport space: the plate is `position: absolute` while it holds a slot,
    // so these four numbers hold still through a scroll and the browser moves plate and slot
    // together. See `plateBoxForSlot`.
    const box = plateBoxForSlot(frame.rect, document.documentElement.getBoundingClientRect());
    // A zero-area slot (a collapsed container, a measurement taken mid-reflow): hold the claim —
    // the reader is still inside this moment's document position — but stop painting, so a
    // zero-height canvas never gets resized and the plate does not sit uncovered at its resting
    // full-viewport box.
    if (!boxIsPaintable(box)) {
      lastFramedBoxRef.current = null;
      releasePlateSlot(plate);
      return;
    }

    const last = lastFramedBoxRef.current;
    const moved =
      last === null ||
      last.top !== box.top ||
      last.left !== box.left ||
      last.width !== box.width ||
      last.height !== box.height;
    const resized = last === null || last.width !== box.width || last.height !== box.height;
    if (moved) {
      lastFramedBoxRef.current = box;
      plate.style.setProperty('--ds-plate-frame-top', `${box.top}px`);
      plate.style.setProperty('--ds-plate-frame-left', `${box.left}px`);
      plate.style.setProperty('--ds-plate-frame-width', `${box.width}px`);
      plate.style.setProperty('--ds-plate-frame-height', `${box.height}px`);
    }
    // The marker CSS keys on, distinguishing "holding a slot" from the record page's resting
    // Framed posture. Written last, so the geometry is never applied without its rect.
    plate.dataset.plateSlot = '1';
    setPosture((current) => (current === 'framed' ? current : 'framed'));

    // First contact with the stage on this surface: a reading room never calls the handle, so
    // without this a moment would frame an empty plate.
    ensureMap();
    const map = mapRef.current;
    if (!map) return;
    lockGestures(map);
    map.getCanvas().tabIndex = -1;
    // Only a real size change needs the drawing buffer re-measured. A scroll no longer produces
    // one at all, which is the point: MapLibre never resizes mid-gesture.
    if (resized) resizeMapInPlace(map);

    if (lastFramedMomentRef.current === frame.id) return;
    lastFramedMomentRef.current = frame.id;
    const camera = resolveMomentCamera(frame.camera, {
      plain: frame.plain,
      reducedMotion: reducedMotionRef.current?.matches() ?? false,
    });
    const target = {
      center: [camera.center[0], camera.center[1]] as [number, number],
      zoom: camera.zoom,
      pitch: camera.pitch,
      bearing: camera.bearing,
    };
    if (camera.move === 'cut') map.jumpTo(target);
    else map.flyTo(target);
  });

  /**
   * Every method that needs a live plate goes through `ensureMap` first, which is what makes the
   * lazy build self-enforcing: a surface cannot use the stage without asking for it, and a
   * surface that never asks never pays for a GL context.
   *
   * `subscribe` and `mapAvailable` are deliberately NOT wrapped. Subscribing is how a surface
   * learns the plate failed, and reading availability is a render-time question — building a
   * WebGL context to answer either would defeat the whole arrangement.
   */
  const handle = useMemo<MapStageHandle>(
    () => ({
      patchData: (patch, options) => {
        ensureMap();
        patchData(patch, options);
      },
      applyViewState: (patch) => {
        ensureMap();
        applyViewState(patch);
      },
      flyPreset: (name, target, options) => {
        ensureMap();
        flyPreset(name, target, options);
      },
      subscribe,
      mapAvailable,
      setSearchCenterMarker: (input) => {
        ensureMap();
        setSearchCenterMarker(input);
      },
      clearSearchCenterMarker,
      setSearchArea: (area) => {
        ensureMap();
        setSearchArea(area);
      },
      resize: () => {
        ensureMap();
        resize();
      },
      setDoorBrowseLive,
      setPlaceTokens,
      setMapLabels,
      getMap: () => {
        ensureMap();
        return getMap();
      },
    }),
    [
      ensureMap,
      patchData,
      applyViewState,
      flyPreset,
      subscribe,
      mapAvailable,
      setSearchCenterMarker,
      clearSearchCenterMarker,
      setSearchArea,
      resize,
      setDoorBrowseLive,
      setPlaceTokens,
      setMapLabels,
      getMap,
    ],
  );

  return (
    <MapStageContext.Provider value={handle}>
      {/* The sole persistent canvas element (`docs/decisions-carryover.md`, "Persistent map
          canvas"). `.ds-map-stage` is a fixed full-viewport plate behind page chrome, styled
          from `app/shell.css` (the sheet the root layout loads on every route) since the
          provider was hoisted out of the map route group; `maplibregl.Map`'s `container` must be a
          separate inner div, never the plate itself — MapLibre stamps its own `maplibregl-map`
          class onto whatever container it's given, and maplibre-gl.css hard-codes
          `position: relative` on that class, which would silently clobber the plate's
          `position: fixed` (same element, same specificity, later cascade wins) and put the
          canvas back in normal document flow. `aria-hidden` on the plate: the synchronized
          result list is this map's accessible-parity surface, so the canvas itself carries no
          separate a11y tree. */}
      <div className="ds-map-stage" data-plate-posture={posture} ref={plateRef} aria-hidden="true">
        <div ref={containerRef} className="ds-map-stage__canvas" />
      </div>
      <Suspense fallback={null}>
        <SearchAwareSurfaceClass onChange={onSearchAwareSurface} />
      </Suspense>
      {children}
    </MapStageContext.Provider>
  );
}
