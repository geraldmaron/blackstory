'use client';

/**
 * The persistent map canvas (ADR-017 "Persistent map canvas — one MapLibre instance
 * across hero and explore"). `MapStageProvider` mounts once in the root shell
 * (`components/SiteShell.tsx`), above every route, so it never remounts on navigation — only
 * the page tree beneath it swaps. That means this component's mount effect below runs exactly
 * once per page load: the WebGL context, loaded tiles, and camera all survive route changes by
 * construction, not by choreography.
 *
 * Refactored from the former `apps/web/src/app/map/ExploreMapCanvas.tsx` (deleted — its
 * instance-lifecycle code lives here now). Every mutation helper below (`applyGeographyStyle`,
 * `setSelectedStateFilter`, `setHistoryEdgeData`, `syncCircularMarkers`, …) is a straight port;
 * what changed is the OUTER shape: instead of a props-driven component that a page mounts and
 * unmounts, this is a long-lived provider whose imperative API (`patchData` / `applyViewState` /
 * `flyPreset` / `subscribe`) pages call through `useMapStage()`. Dignity redaction flow, cluster
 * config, and `activateOnBackgroundClick`-equivalent semantics are all unchanged in substance —
 * see this module's exports' own doc comments for what moved where.
 *
 * `maplibre-gl` (and its CSS) are only ever dynamically imported here — the app's ONE such
 * import (ADR-017 consequence).
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
  MapLayerMouseEvent,
  MapMouseEvent,
  Marker,
  StyleSpecification,
} from 'maplibre-gl';
import type * as MapLibreNamespace from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
/** Explore HTML entity markers reuse Door first-paint pin discs (`entity-marker-sync.ts`). */
import '../../app/first-paint-pin-plate.css';
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import {
  EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
  EXPLORE_ENTITIES_SOURCE_ID,
  EXPLORE_HISTORY_EDGES_INCOMING_SOURCE_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_SELECTED_POINT_LAYER_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from '../../app/map/explore-layer-ids';
import {
  buildExploreMapStyle,
  ENTITY_SELECTED_PULSE_DURATION_MS,
  ENTITY_SELECTED_RADIUS_OFFSET,
  entitySelectedPulseOpacity,
  entitySelectedPulseRadiusExpression,
  entitySelectedPulseStaticRadiusExpression,
  ENTITY_SELECTED_PULSE_STATIC_OPACITY,
} from '../../app/map/explore-style';
import { markerRadiusPlusExpression } from '../../lib/map-experience/marker-size';
import {
  applyDensityBlendProgress,
  buildDensityColorMorphStates,
  clearDensityMorphFeatureState,
  DECADE_LAYER_FADE_MS,
  runDecadeMorphAnimation,
  restoreDecadeFadePaintFromStyle,
  setDecadeCrossfadeTransitions,
  type DecadeMorphAnimationHandle,
  type DensityColorMorphState,
} from '../../app/map/decade-layer-transition';
import type { MapColorScheme } from '../../lib/map-experience/dignity-style';
import { EXPLORE_CLUSTER_CONFIG } from '../../lib/map-experience/dignity-style';
import {
  diffEntityMarkerIds,
  shouldMountEntityMarkers,
} from '../../lib/map-experience/entity-marker-diff';
import {
  bindMapResizeLifecycle,
  bindWebGlContextRecovery,
  isWebGlAvailable,
} from '../../lib/map-experience/map-libre-lifecycle';
import {
  ENTITY_POINTER_HIT_LAYER_IDS,
  MAP_CLICK_TOLERANCE_PX,
  pointerHitBox,
  resolveEntityPointerHit,
} from '../../lib/map-experience/entity-pointer-hit';
import {
  clampClusterExpansionZoom,
  clusterExpandDurationMs,
} from '../../lib/map-experience/cluster-expand';
import type {
  ExploreMapFeatureCollection,
  JurisdictionAreaFeature,
} from '../../lib/map-experience/build-explore-map-source';
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  prefersFinePointer,
  prefersReducedMotion,
  type CameraPresetName,
} from '../../lib/map-experience/camera-presets';
import type { HistoryEdgeLineCollection } from '../../lib/map-experience/build-history-edge-lines';
import type { StateDensityLevel } from '../../lib/map-experience/density';
import type { CountyChoroplethLevel } from '../../lib/map-experience/county-choropleth';
import type { StateChoroplethLevel } from '../../lib/map-experience/state-choropleth';
import {
  joinDensityOntoStatePolygons,
  indexDensityFillColors,
} from '../../lib/map-experience/join-state-polygons';
import * as stateLabels from '../../lib/map-experience/state-labels';
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
import { readDocumentColorScheme, stateLabelColorFor } from './color-scheme';
import { EMPTY_EDGE_COLLECTION, EMPTY_FEATURE_COLLECTION, type StageConfig } from './stage-config';
import {
  applyGeographyStyle,
  buildStyleForScheme,
  setSelectedStateFilter,
} from './style-application';
import {
  applyEntityMarkerElementProps,
  clearMarkers,
  markerLabelFor,
  syncSelectedEntityMarkerClass,
} from './entity-marker-sync';
import {
  setHistoryEdgeData,
  setHistoryEdgesVisibility,
  setSelectedEdgeFilter,
  setSelectedEntityFilter,
} from './selection-sync';
import {
  fetchStatePolygons,
  loadStatePolygonsWithDensity,
  requestCountyPolygonLoad,
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
import { usePathname } from 'next/navigation';
import { surfaceClassFor, type SurfaceClass } from '../../lib/nav/surface-classes';
import { useSurfaceClass } from '../../lib/nav/use-surface-class';
import { defaultPostureFor, framedClaimAllowed, type PlatePosture } from './plate-posture';
import { createFramedSlotRegistry } from './framed-slot-registry';
import { insetIsPaintable, plateInsetForSlot, resolvePlatePosture } from './plate-frame';
import { applyGesturesForPosture, lockGestures, rotateGestureAllowed } from './gesture-lock';
import {
  attachSafariTwistRotate,
  attachShiftDragRotate,
  type RotateGestureHandle,
} from './custom-rotate-gestures';
import { createReducedMotionListener, type ReducedMotionListener } from './reduced-motion-listener';
// The plate is the subscriber half of the seam `MapMoment` documents: the stage publishes which
// moment is live and where, and never touches a map itself.
import { resolveMomentCamera, useMapMomentFrame } from '../room/MapMoment';

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

export type MapStageHandle = {
  /** Patches source data + density/history-edge mode flags; rebuilds the style and reapplies
   * geography layers + entity markers. Pass `{ fade: true }` for decade-flow dual-buffer
   * crossdissolve (presence colors morph; plate never blanks). */
  readonly patchData: (patch: MapStageDataPatch, options?: MapStageDataPatchOptions) => void;
  /** Patches the selected-state / selected-edge highlight filters (and the state-label
   * selection color) without touching source data or the style. */
  readonly applyViewState: (patch: MapStageViewPatch) => void;
  /** The only sanctioned way to move the camera (ADR-017: "raw flyTo defaults are banned").
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
  /** Re-read container layout after external geometry changes (hero inset, panel open). */
  readonly resize: () => void;
  /**
   * The live MapLibre map, or null before it starts and after it fails.
   *
   * Deliberately narrow: `camera-moves.ts` drives the plate through a structural `MapLike`, and
   * this is how that library reaches the one persistent canvas. It is not an invitation to call
   * `flyTo` directly — ADR-017's ban on raw camera calls still holds, and `flyPreset` remains the
   * route for preset framing.
   */
  readonly getMap: () => AtlasCameraTarget | null;
};

/** What the camera library needs off the map. Structural, so `MapStage` owes it no import. */
export type AtlasCameraTarget = {
  flyTo(options: never): unknown;
  easeTo(options: never): unknown;
  fitBounds(bounds: never, options: never): unknown;
  getZoom(): number;
  getBearing(): number;
  getPitch(): number;
  getCenter(): { lng: number; lat: number };
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
 * Keyed sync of the DOM hit-target markers — the single-feature invariant (repo-4v3a.1 /
 * repo-mrmh / repo-pgzr) extended to the DOM path: markers are keyed by `entityId` and reused
 * in place, so a selection change or `zoomend` resync never mass-unmounts and recreates the
 * whole collection (which read as "all entities light up"). Only genuinely new ids mount and
 * only stale ids unmount.
 */
/** Hover-intent delay before a pin's photo card opens (`PinPhotoCard`'s own doc comment). */
const PIN_HOVER_INTENT_MS = 120;

function syncCircularMarkers(
  map: MapLibreMap,
  maplibregl: MaplibreModule['default'],
  features: ExploreMapFeatureCollection['features'],
  markers: Marker[],
  onSelect: (entityId: string) => void,
  selectedEntityId: string | undefined,
  onHover: (
    target: { readonly entityId: string; readonly name: string; readonly rect: DOMRect } | null,
  ) => void,
): void {
  // Below clusterMaxZoom, MapLibre aggregates points — HTML hit-targets for every feature
  // sit above clusters and steal clicks. Only mount DOM targets once individuals are visible.
  if (!shouldMountEntityMarkers(map.getZoom(), EXPLORE_CLUSTER_CONFIG.clusterMaxZoom)) {
    clearMarkers(markers);
    return;
  }

  const mountedById = new Map<string, Marker>();
  for (const marker of markers) {
    const id = marker.getElement().dataset.entityId;
    if (typeof id === 'string') mountedById.set(id, marker);
  }

  type PointFeature = ExploreMapFeatureCollection['features'][number];
  const featureById = new Map<string, { feature: PointFeature; lng: number; lat: number }>();
  for (const feature of features) {
    if (feature.geometry.type !== 'Point') continue;
    const [lng, lat] = feature.geometry.coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number') continue;
    const entityId = feature.properties.entityId;
    if (typeof entityId !== 'string') continue;
    if (featureById.has(entityId)) continue;
    featureById.set(entityId, { feature, lng, lat });
  }

  const diff = diffEntityMarkerIds(mountedById.keys(), featureById.keys());

  for (const entityId of diff.keep) {
    const mounted = mountedById.get(entityId);
    const entry = featureById.get(entityId);
    if (!mounted || !entry) continue;
    applyEntityMarkerElementProps(
      mounted.getElement() as HTMLButtonElement,
      entry.feature,
      markerLabelFor(entry.feature),
      selectedEntityId === entityId,
    );
    mounted.setLngLat([entry.lng, entry.lat]);
  }

  for (const entityId of diff.add) {
    const entry = featureById.get(entityId);
    if (!entry) continue;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'ds-first-paint-pin ds-first-paint-pin--link ds-map-entity-marker';
    el.dataset.entityId = entityId;
    applyEntityMarkerElementProps(
      el,
      entry.feature,
      markerLabelFor(entry.feature),
      selectedEntityId === entityId,
    );
    // The map canvas is `aria-hidden` (see `MapStageProvider`'s render) — the synchronized
    // result list is the accessible-parity surface for the same entities, so these buttons
    // are deliberately pulled out of the tab order rather than left focusable-but-hidden
    // (a WAI-ARIA anti-pattern).
    el.tabIndex = -1;
    el.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect(entityId);
    });
    // Pin-photo hover intent: a short delay on enter (so a cursor passing over the plate does not
    // flicker cards open), immediate on leave. `PinPhotoCard`'s doc comment has the full contract.
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;
    el.addEventListener('mouseenter', () => {
      if (hoverTimer !== null) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        hoverTimer = null;
        onHover({ entityId, name: el.dataset.pinName ?? '', rect: el.getBoundingClientRect() });
      }, PIN_HOVER_INTENT_MS);
    });
    el.addEventListener('mouseleave', () => {
      if (hoverTimer !== null) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      onHover(null);
    });
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([entry.lng, entry.lat])
      .addTo(map);
    mountedById.set(entityId, marker);
  }

  // Unmount only stale ids — never the survivors.
  for (const entityId of diff.remove) {
    mountedById.get(entityId)?.remove();
    mountedById.delete(entityId);
  }

  markers.length = 0;
  for (const entityId of featureById.keys()) {
    const marker = mountedById.get(entityId);
    if (marker) markers.push(marker);
  }
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
  /** The posture as of the last render, readable from the async mount path below. */
  const postureRef = useRef<PlatePosture>(posture);
  postureRef.current = posture;
  /** The custom rotate gestures currently attached (`custom-rotate-gestures.ts`), or both null
   * when the posture has them detached. One ref, not two independent booleans, so the pair
   * attaches and detaches together — see that module's doc comment for why they are one
   * capability. */
  const rotateGesturesRef = useRef<{
    shift: RotateGestureHandle | null;
    twist: RotateGestureHandle | null;
  }>({ shift: null, twist: null });
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreglRef = useRef<MaplibreModule['default'] | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const searchCenterMarkerRef = useRef<Marker | null>(null);
  /** Soft opacity pulse on the GL selected ring — canceled when selection clears. */
  const selectedPulseRafRef = useRef<number | null>(null);
  const stateLabelMarkersRef = useRef<
    Map<string, { readonly marker: Marker; readonly element: HTMLDivElement }>
  >(new Map());
  const listenersRef = useRef(makeListenerStore());
  const lastViewportRef = useRef<ExploreViewportFrame | undefined>(undefined);
  const [mapAvailable, setMapAvailable] = useState(true);
  const mapAvailableRef = useRef(true);
  /**
   * GL lifecycle, held in refs rather than closure locals because construction no longer happens
   * inside the effect that tears it down — `ensureMap` can fire from any handle call, while the
   * teardown still belongs to a single unmount effect.
   */
  const initStartedRef = useRef(false);
  const cancelledRef = useRef(false);
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
  /**
   * Latches true on MapLibre `load`. Do NOT gate decade morphs on `isStyleLoaded()` —
   * GeoJSON setData / tile fetches flip that false and force the snap path (full refresh).
   */
  const mapStyleReadyRef = useRef(false);
  /** Latest apply options waiting for the style to settle — null when nothing is pending. */
  const pendingStyleApplyRef = useRef<Parameters<typeof applyStyleAndData>[0] | null>(null);
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
    plateRef.current?.removeAttribute('data-plate-ready');
    notify(listenersRef.current, 'error');
  }, []);

  const syncEntityMarkers = useCallback(() => {
    const map = mapRef.current;
    const maplibregl = maplibreglRef.current;
    if (!map || !maplibregl) return;
    try {
      syncCircularMarkers(
        map,
        maplibregl,
        configRef.current.featureCollection.features,
        markersRef.current,
        (entityId) => notify(listenersRef.current, 'select', entityId),
        configRef.current.selectedEntity,
        (target) => notify(listenersRef.current, 'pinHover', target),
      );
    } catch (error) {
      console.error('[MapStage] marker sync failed', error);
      markMapUnavailable();
    }
  }, [markMapUnavailable]);

  const updateStateLabelSelection = useCallback((selectedPostalCode: string | undefined) => {
    const scheme = readDocumentColorScheme();
    for (const [postalCode, entry] of stateLabelMarkersRef.current) {
      const selected = postalCode === selectedPostalCode;
      entry.element.classList.toggle(stateLabels.STATE_LABEL_SELECTED_CLASS_NAME, selected);
      entry.element.style.color = stateLabelColorFor(scheme, selected);
    }
  }, []);

  const syncStateLabelTheme = useCallback((scheme: MapColorScheme) => {
    for (const [postalCode, entry] of stateLabelMarkersRef.current) {
      const selected = postalCode === configRef.current.selectedState;
      entry.element.classList.toggle(stateLabels.STATE_LABEL_SELECTED_CLASS_NAME, selected);
      entry.element.style.color = stateLabelColorFor(scheme, selected);
    }
  }, []);

  const updateStateLabelOpacity = useCallback((zoom: number) => {
    const opacity = String(stateLabels.stateLabelOpacityForZoom(zoom));
    for (const [, entry] of stateLabelMarkersRef.current) {
      entry.element.style.opacity = opacity;
    }
  }, []);

  const stopSelectedEntityPulse = useCallback(() => {
    if (selectedPulseRafRef.current !== null) {
      cancelAnimationFrame(selectedPulseRafRef.current);
      selectedPulseRafRef.current = null;
    }
    const map = mapRef.current;
    if (map?.getLayer(EXPLORE_SELECTED_POINT_LAYER_ID)) {
      // Reset to the base (un-pulsed) ring — scale 1x, full opacity.
      map.setPaintProperty(
        EXPLORE_SELECTED_POINT_LAYER_ID,
        'circle-radius',
        markerRadiusPlusExpression(ENTITY_SELECTED_RADIUS_OFFSET),
      );
      map.setPaintProperty(EXPLORE_SELECTED_POINT_LAYER_ID, 'circle-stroke-opacity', 1);
    }
  }, []);

  const startSelectedEntityPulse = useCallback(
    (entityId: string) => {
      stopSelectedEntityPulse();
      const map = mapRef.current;
      if (!map?.getLayer(EXPLORE_SELECTED_POINT_LAYER_ID)) return;
      if (prefersReducedMotion()) {
        // Reduced motion (patterns-cinematic-map.md §3): no loop — a single static
        // enlarged ring (scale ~1.35, opacity ~0.85).
        map.setPaintProperty(
          EXPLORE_SELECTED_POINT_LAYER_ID,
          'circle-radius',
          entitySelectedPulseStaticRadiusExpression(),
        );
        map.setPaintProperty(
          EXPLORE_SELECTED_POINT_LAYER_ID,
          'circle-stroke-opacity',
          ENTITY_SELECTED_PULSE_STATIC_OPACITY,
        );
        return;
      }

      const startedAt = performance.now();
      const tick = (now: number) => {
        if (configRef.current.selectedEntity !== entityId || !mapRef.current) {
          selectedPulseRafRef.current = null;
          return;
        }
        const activeMap = mapRef.current;
        if (!activeMap.getLayer(EXPLORE_SELECTED_POINT_LAYER_ID)) {
          selectedPulseRafRef.current = null;
          return;
        }
        // 1.8s ease-in-out loop — ring scales ~1x -> ~2.1x while fading 0.9 -> 0.12
        // (patterns-cinematic-map.md §3 "Selection pulse").
        const progress =
          ((now - startedAt) % ENTITY_SELECTED_PULSE_DURATION_MS) /
          ENTITY_SELECTED_PULSE_DURATION_MS;
        activeMap.setPaintProperty(
          EXPLORE_SELECTED_POINT_LAYER_ID,
          'circle-radius',
          entitySelectedPulseRadiusExpression(progress),
        );
        activeMap.setPaintProperty(
          EXPLORE_SELECTED_POINT_LAYER_ID,
          'circle-stroke-opacity',
          entitySelectedPulseOpacity(progress),
        );
        selectedPulseRafRef.current = requestAnimationFrame(tick);
      };
      selectedPulseRafRef.current = requestAnimationFrame(tick);
    },
    [stopSelectedEntityPulse],
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
      /** Skip entity HTML marker sync (defer until promote after crossdissolve). */
      readonly skipEntityMarkers?: boolean;
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
        const selectedId = configRef.current.selectedEntity;
        if (selectedId && selectedId.length > 0) {
          startSelectedEntityPulse(selectedId);
        } else {
          stopSelectedEntityPulse();
        }
        if (!options?.skipPrimaryDensityLoad) {
          void loadStatePolygonsWithDensity(
            map,
            configRef.current.densityLevels,
            configRef.current.stateChoroplethLevels,
          )
            .then((joined) => {
              settledDensityFillByFipsRef.current = indexDensityFillColors(joined);
              if (joined.features.length > 0) stampPlateReady(plateRef.current);
            })
            .catch((error) => {
              console.error('[MapStage] state polygon load failed', error);
            });
        }
        requestCountyPolygonLoad(map, configRef.current);
        if (!options?.skipEntityMarkers) {
          syncEntityMarkers();
        }
      } catch (error) {
        console.error('[MapStage] style/data apply failed', error);
      }
    },
    [startSelectedEntityPulse, stopSelectedEntityPulse, syncEntityMarkers],
  );
  applyStyleAndDataRef.current = applyStyleAndData;

  const syncPlatePaintToTheme = useCallback(
    (map: MapLibreMap, style: StyleSpecification, scheme: MapColorScheme) => {
      syncLayerPaintFromStyle(map, style, PERSISTENT_PLATE_LAYER_IDS, (update, error) => {
        console.error(
          `[MapStage] setPaintProperty ${update.layerId}.${update.paintKey} failed`,
          error,
        );
      });
      syncStateLabelTheme(scheme);
    },
    [syncStateLabelTheme],
  );

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
      const style = buildExploreMapStyle({
        featureCollection: patch.featureCollection,
        jurisdictionAreaFeatures: patch.jurisdictionAreaFeatures,
        layerMode: patch.layerMode,
        popGeo,
        historyEdgesEnabled: patch.historyEdgesEnabled,
        clusteringEnabled,
        satellite,
        colorScheme: readDocumentColorScheme(),
      });
      configRef.current = {
        ...configRef.current,
        style,
        featureCollection: patch.featureCollection,
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
            ...(applyOptions.skipEntityMarkers ? { skipEntityMarkers: true as const } : {}),
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
      entitiesIncoming.setData(cfg.featureCollection as any);
      await waitForGeoJsonSourceData(map, EXPLORE_ENTITIES_INCOMING_SOURCE_ID);
    }
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
      const entities = map.getSource(EXPLORE_ENTITIES_SOURCE_ID) as GeoJSONSource | undefined;
      if (entities) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
        entities.setData(cfg.featureCollection as any);
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
      syncEntityMarkers();
    },
    [clearIncomingDecadeBuffers, syncEntityMarkers],
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
      if (!map || !map.isStyleLoaded()) return;
      const cfg = configRef.current;
      const scheme = readDocumentColorScheme();
      const style = buildStyleForScheme(cfg, scheme);
      configRef.current = { ...cfg, style };
      applyStyleAndData();
      syncPlatePaintToTheme(map, style, scheme);
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
      updateStateLabelSelection(patch.selectedState);
      syncSelectedEntityMarkerClass(markersRef.current, patch.selectedEntity);
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      setSelectedStateFilter(map, patch.selectedState);
      setSelectedEdgeFilter(map, patch.selectedEdge);
      setSelectedEntityFilter(map, patch.selectedEntity);
      if (patch.selectedEntity && patch.selectedEntity.length > 0) {
        startSelectedEntityPulse(patch.selectedEntity);
      } else {
        stopSelectedEntityPulse();
      }
    },
    [startSelectedEntityPulse, stopSelectedEntityPulse, updateStateLabelSelection],
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
      mapRef.current?.resize();
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
      const container = containerRef.current;
      const current = rotateGesturesRef.current;
      const allowed = container !== null && rotateGestureAllowed(posture, { pointerFine });
      if (allowed && !current.shift) {
        current.shift = attachShiftDragRotate(map, container);
        current.twist = attachSafariTwistRotate(map, container);
      } else if (!allowed && current.shift) {
        current.shift.detach();
        current.twist?.detach();
        current.shift = null;
        current.twist = null;
      }
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
        const element = buildExploreSearchCenterMarkerElement(marker.label);
        searchCenterMarkerRef.current = new maplibregl.Marker({ element, anchor: 'bottom' })
          .setLngLat([marker.lng, marker.lat])
          .addTo(map);
      } catch (error) {
        console.error('[MapStage] search center marker failed', error);
      }
    },
    [clearSearchCenterMarker],
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
    if (initStartedRef.current || cancelledRef.current) return;
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
        if (cancelledRef.current || !container.isConnected || mapRef.current) return;

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
          style: buildArchiveBaseStyle(mountScheme),
          attributionControl: false,
          clickTolerance: MAP_CLICK_TOLERANCE_PX,
          // Keep the camera US-centered without a tight maxBounds box (see the former
          // ExploreMapCanvas's identical comment): a portrait canvas cannot show full CONUS
          // east-west if maxBounds also caps latitude.
          renderWorldCopies: false,
          // Street-level context is available (OpenFreeMap roads from z8); stop short of
          // address-level invasion — precision redaction still governs marker honesty.
          minZoom: MAP_MIN_ZOOM,
          maxZoom: MAP_MAX_ZOOM,
          // The national frame is the resting camera for every surface, so a provider mounted
          // without a `bounds` prop opens on the same view rather than on MapLibre's [0,0].
          bounds: (bounds ?? US_CONUS_BOUNDS) as [number, number, number, number],
          fitBoundsOptions: { padding: 32 },
        });

        mapRef.current = map;
        if (process.env.NODE_ENV !== 'production') {
          // Dev-only escape hatch for in-browser inspection and perf traces.
          (window as unknown as Record<string, unknown>).__bpMapStage = map;
        }
        // No `NavigationControl`. Zoom and pitch live in the Explore camera console, so the map
        // keeps one control vocabulary (design-direction-v9-atlas.md §5.5). Attribution stays:
        // it is a license obligation, not chrome we get to choose.
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
        map.on('error', (event) => {
          console.error('[MapStage]', event.error);
        });
      } catch {
        if (!cancelledRef.current) markMapUnavailable();
        return;
      }

      if (cancelledRef.current || !map) {
        map?.remove();
        mapRef.current = null;
        return;
      }

      const activeMap = map;

      // State-label markers mount first so, by DOM insertion order, entity markers layer above
      // them (state-labels.ts's documented belt-and-suspenders stacking guidance).
      const descriptors = stateLabels.buildStateLabelMarkers(configRef.current.selectedState);
      for (const descriptor of descriptors) {
        const element = stateLabels.buildStateLabelElement(descriptor);
        const marker = new (maplibreglRef.current as MaplibreModule['default']).Marker({
          element,
          anchor: 'center',
        })
          .setLngLat([descriptor.lngLat[0], descriptor.lngLat[1]])
          .addTo(activeMap);
        stateLabelMarkersRef.current.set(descriptor.postalCode, { marker, element });
      }
      syncStateLabelTheme(readDocumentColorScheme());
      updateStateLabelOpacity(activeMap.getZoom());

      // MapLibre constructs with every gesture on. Only Live starts fully steered; a plate built
      // on the Door (ambient) hands back drag/zoom-adjust on a precise pointer only, and one built
      // into a moment (framed) starts fully locked — either way, the first wheel over the map
      // must still scroll the document that asked for it.
      applyGesturesForPosture(activeMap, postureRef.current, { pointerFine: prefersFinePointer() });
      syncRotateGestures(activeMap, postureRef.current, prefersFinePointer());

      syncEntityMarkers();
      lastViewportRef.current = readViewport(activeMap);
      notify(listenersRef.current, 'viewport', lastViewportRef.current);

      /**
       * National discs are a few pixels; query a padded box so a near-miss still opens
       * the record sheet instead of selecting the state fill underneath.
       */
      function pointerHitAt(point: { x: number; y: number }) {
        const layers = ENTITY_POINTER_HIT_LAYER_IDS.filter((id) => activeMap.getLayer(id));
        if (layers.length === 0) return undefined;
        const features = activeMap.queryRenderedFeatures(pointerHitBox(point), { layers });
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

      function expandClusterFromPointerHit(
        hit: Extract<NonNullable<ReturnType<typeof pointerHitAt>>, { kind: 'cluster' }>,
      ): void {
        notify(listenersRef.current, 'deselect');
        const source = activeMap.getSource(hit.sourceId) as GeoJSONSource | undefined;
        if (!source) return;
        void source
          .getClusterExpansionZoom(hit.clusterId)
          .then((expansionZoom) => {
            activeMap.easeTo({
              center: [hit.center[0], hit.center[1]],
              zoom: clampClusterExpansionZoom(expansionZoom, activeMap.getZoom()),
              duration: clusterExpandDurationMs(prefersReducedMotion()),
            });
          })
          .catch(() => {
            // Cluster may have dissolved between click and lookup.
          });
      }

      function handleEntityPointerHit(hit: NonNullable<ReturnType<typeof pointerHitAt>>): void {
        if (hit.kind === 'entity') {
          notify(listenersRef.current, 'select', hit.entityId);
          return;
        }
        expandClusterFromPointerHit(hit);
      }

      function handleEntityPointerClick(event: MapMouseEvent) {
        const hit = pointerHitAt(event.point);
        if (!hit) return;
        handleEntityPointerHit(hit);
      }

      function handleStateClick(event: MapLayerMouseEvent) {
        if (pointerHitAt(event.point)) return;
        const postal = event.features?.[0]?.properties?.postalCode;
        if (typeof postal === 'string' && postal.length > 0) {
          notify(listenersRef.current, 'stateSelect', postal);
        }
      }

      function handleEdgeClick(event: MapLayerMouseEvent) {
        if (pointerHitAt(event.point)) return;
        const edgeId = event.features?.[0]?.properties?.edgeId;
        if (typeof edgeId === 'string' && edgeId.length > 0) {
          notify(listenersRef.current, 'edgeSelect', edgeId);
        }
      }

      function handleBackgroundClick(event: MapMouseEvent) {
        if (pointerHitAt(event.point)) return;
        const hitLayers = [
          EXPLORE_STATE_DENSITY_LAYER_ID,
          EXPLORE_HISTORY_EDGES_LAYER_ID,
          EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
        ].filter((id) => activeMap.getLayer(id));
        const hits = hitLayers.length
          ? activeMap.queryRenderedFeatures(event.point, { layers: hitLayers })
          : [];
        if (hits.length > 0) return;
        notify(listenersRef.current, 'activate', readViewport(activeMap));
      }

      activeMap.once('load', () => {
        mapStyleReadyRef.current = true;
        applyStyleAndData();
        // Hide the Albers locator once the live plate has painted so camera moves and
        // uncovered pin/cluster clicks hit MapLibre, not the underlay.
        activeMap.once('idle', () => {
          if (!cancelledRef.current) stampPlateReady(plateRef.current);
        });
        window.setTimeout(() => {
          if (!cancelledRef.current) stampPlateReady(plateRef.current);
        }, 1800);
        const canvas = activeMap.getCanvas();
        contextRecoveryRef.current = bindWebGlContextRecovery(
          canvas,
          () => {
            if (!cancelledRef.current) markMapUnavailable();
          },
          () => {
            if (!cancelledRef.current) activeMap.resize();
          },
        );
        if (activeMap.getLayer(EXPLORE_STATE_DENSITY_LAYER_ID)) {
          activeMap.on('click', EXPLORE_STATE_DENSITY_LAYER_ID, handleStateClick);
          activeMap.on('mouseenter', EXPLORE_STATE_DENSITY_LAYER_ID, () => {
            activeMap.getCanvas().style.cursor = 'pointer';
          });
          activeMap.on('mouseleave', EXPLORE_STATE_DENSITY_LAYER_ID, () => {
            activeMap.getCanvas().style.cursor = '';
          });
        }
        if (activeMap.getLayer(EXPLORE_HISTORY_EDGES_LAYER_ID)) {
          activeMap.on('click', EXPLORE_HISTORY_EDGES_LAYER_ID, handleEdgeClick);
          activeMap.on('mouseenter', EXPLORE_HISTORY_EDGES_LAYER_ID, () => {
            activeMap.getCanvas().style.cursor = 'pointer';
          });
          activeMap.on('mouseleave', EXPLORE_HISTORY_EDGES_LAYER_ID, () => {
            activeMap.getCanvas().style.cursor = '';
          });
        }
        activeMap.on('click', handleEntityPointerClick);
        activeMap.on('click', handleBackgroundClick);
        activeMap.resize();
        // Flush camera requested while the canvas was still constructing (e.g. locate → explore
        // deep link with radius bounds). Prefer the pending flight over the constructor CONUS frame.
        const pending = pendingFlyRef.current;
        if (pending) {
          pendingFlyRef.current = null;
          runFlyPreset(pending.name, pending.target, pending.options);
        }
      });

      activeMap.on('moveend', () => {
        lastViewportRef.current = readViewport(activeMap);
        notify(listenersRef.current, 'viewport', lastViewportRef.current);
        updateStateLabelOpacity(activeMap.getZoom());
      });
      activeMap.on('zoom', () => {
        updateStateLabelOpacity(activeMap.getZoom());
        // DOM hit-target discs are fixed-pixel; a camera ease that crosses the cluster gate
        // (closing a record card flies point zoom -> national) must unmount them at the
        // crossing, not at `zoomend` — otherwise every disc rides the whole flight oversized
        // and the map reads as "all entities light up" (repo-pgzr).
        if (
          !shouldMountEntityMarkers(activeMap.getZoom(), EXPLORE_CLUSTER_CONFIG.clusterMaxZoom) &&
          markersRef.current.length > 0
        ) {
          clearMarkers(markersRef.current);
        }
      });
      activeMap.on('zoomend', () => {
        syncEntityMarkers();
        requestCountyPolygonLoad(activeMap, configRef.current);
      });
      // Every rotate frame, not just `moveend` — the compass needle (`CameraConsole`) tracks a
      // live drag/twist, and `viewport` only fires once the gesture settles.
      activeMap.on('rotate', () => {
        notify(listenersRef.current, 'rotate', activeMap.getBearing());
      });

      // Cursor affordance uses the same padded hit as selection so a near-miss still
      // reads as a pin, not empty plate.
      activeMap.on('mousemove', (event: MapMouseEvent) => {
        activeMap.getCanvas().style.cursor = pointerHitAt(event.point) ? 'pointer' : '';
      });

      resizeLifecycleRef.current = bindMapResizeLifecycle(container, () => {
        activeMap.resize();
      });
      resizeTimerRef.current = setTimeout(() => {
        syncEntityMarkers();
        activeMap.resize();
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
     * reset the simulated unmount below left `cancelledRef` true for the life of the page: the
     * first `patchData` had already started the `maplibre-gl` import, the import resolved into a
     * canceled provider and returned, and no later call could retry because `initStartedRef`
     * was still set. The chunk loaded, the plate never built, and every dev session showed the
     * Albers underlay in place of the map — a failure invisible in production, where StrictMode
     * does not double-invoke.
     */
    cancelledRef.current = false;
    initStartedRef.current = false;
    return () => {
      cancelledRef.current = true;
      pendingFlyRef.current = null;
      decadeFadeGenerationRef.current += 1;
      decadeDissolveInFlightRef.current = false;
      decadeMorphAnimationRef.current?.cancel();
      decadeMorphAnimationRef.current = null;
      mapStyleReadyRef.current = false;
      if (selectedPulseRafRef.current !== null) {
        cancelAnimationFrame(selectedPulseRafRef.current);
        selectedPulseRafRef.current = null;
      }
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeLifecycleRef.current?.disconnect();
      contextRecoveryRef.current?.disconnect();
      clearMarkers(markersRef.current);
      clearSearchCenterMarker();
      for (const { marker } of stateLabelMarkersRef.current.values()) marker.remove();
      stateLabelMarkersRef.current.clear();
      rotateGesturesRef.current.shift?.detach();
      rotateGesturesRef.current.twist?.detach();
      rotateGesturesRef.current = { shift: null, twist: null };
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
    setPosture(defaultPostureFor(surfaceClass));
  }, [surfaceClass]);

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

    const claimGranted =
      frame !== null && framedClaimAllowed(surfaceClass) && framedSlotsRef.current.claim(frame.id);
    if (claimGranted && frame !== null) heldSlotRef.current = frame.id;

    const next = resolvePlatePosture({
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
    const inset = plateInsetForSlot(frame.rect, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    // A slot scrolled entirely out of view: hold the claim (the reader is still inside this
    // moment's document position) but stop painting, so a zero-height canvas never gets resized
    // and the plate does not sit uncovered at its resting full-viewport box.
    if (!insetIsPaintable(inset)) {
      releasePlateSlot(plate);
      return;
    }

    plate.style.setProperty('--ds-plate-frame-top', `${inset.top}px`);
    plate.style.setProperty('--ds-plate-frame-left', `${inset.left}px`);
    plate.style.setProperty('--ds-plate-frame-width', `${inset.width}px`);
    plate.style.setProperty('--ds-plate-frame-height', `${inset.height}px`);
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
    map.resize();

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
      resize: () => {
        ensureMap();
        resize();
      },
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
      resize,
      getMap,
    ],
  );

  return (
    <MapStageContext.Provider value={handle}>
      {/* The sole persistent canvas element (ADR-017). `.ds-map-stage` is a fixed full-viewport
          plate behind page chrome (map-surfaces.css); `maplibregl.Map`'s `container` must be a
          separate inner div, never the plate itself — MapLibre stamps its own `maplibregl-map`
          class onto whatever container it's given, and maplibre-gl.css hard-codes
          `position: relative` on that class, which would silently clobber the plate's
          `position: fixed` (same element, same specificity, later cascade wins) and put the
          canvas back in normal document flow. `aria-hidden` on the plate: the synchronized
          result list is this map's accessible-parity surface (see `syncCircularMarkers`'s doc
          comment on marker `tabIndex`), so the canvas itself carries no separate a11y tree. */}
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
