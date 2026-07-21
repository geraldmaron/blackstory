'use client';

/**
 * Client orchestrator for `/explore`. Wires the shared `MapStage` (via `useMapStage()`
 * instead of mounting its own canvas), the synchronized accessible list, map data model
 * picker (record presence | Black population share | share change), nearby-points grouping
 * toggle, relationship lines, decade settings, address/place search (Census via `/locate/api`
 * with camera fly-to), filter form, and shareable URL state. Floating chrome is a left
 * instrument chassis (Filters | Color key tabs) plus a records rail/sheet; MapLibre zoom
 * parks in a safe zone so rails never cover it. The records list is scoped to the live map
 * camera bounds (plus active filters) so its count and rows match what is geographically on
 * screen. Pin or list selection opens a preview narrative card in the spotlight shell; the
 * full record is one CTA away at `/entity/[id]`. `?selected=` is shareable preview state
 * (e.g. return from “View on map”). History edge clicks still open a connection panel. The
 * server-rendered snapshot catalog is the source of truth; `/explore/api` refine is optional
 * progressive enhancement when App Check is configured.
 *
 * Camera: inbound deep links (`lat`/`lng`/`zoom`, `state`, radius) and back/forward reconcile
 * the camera via `easeTo` (`reconcileCamera`, once on mount and on every `popstate`) — never a
 * raw default flight (ADR-017). Pan/zoom updates live camera + list bounds only; camera
 * position is not written back into the address bar. Shareable panel/filter URL updates use
 * `history.replaceState` (not Next `router.replace`) so RSC does not re-supply `initial` and
 * fight open/close. Selecting a pin flies briefly then opens the preview card. Closing the
 * card eases one geographic tier up (county → state → country) from the pre-select camera,
 * never a jump cut to full CONUS when the reader was already in a tighter frame.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import Link from 'next/link';
import { Notice } from '@repo/ui';
import { US_CONUS_BOUNDS, findUsStateByPostalCode } from '@repo/domain/map/geography';
import {
  DEFAULT_POPULATION_GEO,
  coercePopulationGeoForDecade,
  defaultPopulationChangeFrom,
  defaultPopulationChangeTo,
  defaultPopulationDecade,
  type ExplorePopulationGeo,
} from '../../../lib/map-experience/explore-population';
import { HistoryEdgePanel } from '../../../components/history/HistoryEdgePanel';
import { ExploreAddressSearch } from '../../../components/map-experience/ExploreAddressSearch';
import type { ExploreAddressResolvedPayload } from '../../../components/map-experience/ExploreAddressSearch';
import { LayerModelControl } from '../../../components/map-experience/LayerModelControl';
import { GroupingToggle } from '../../../components/map-experience/GroupingToggle';
import { MapExperienceLegend } from '../../../components/map-experience/MapExperienceLegend';
import { NarrativeCard } from '../../../components/map-experience/NarrativeCard';
import { SynchronizedResultList } from '../../../components/map-experience/SynchronizedResultList';
import { MetaFieldLabel } from '../../../components/map-experience/MetaFieldLabel';
import { shouldMorphDecadeDataPatch } from '../../map/decade-layer-transition';
import {
  back as sessionBack,
  canBack as sessionCanBack,
  canPickNext,
  createSessionStack,
  pickNext,
  push as sessionPush,
  type SessionStack,
} from '../../../lib/map-experience/entity-session-nav';
import {
  CAMERA_POINT_ZOOM,
  prefersReducedMotion,
} from '../../../lib/map-experience/camera-presets';
import { resolveCloseCameraTarget } from '../../../lib/map-experience/close-camera';
import { buildActiveDensityByDecade } from '../../../lib/map-experience/decade-flow';
import {
  closestFeatures,
  emptyRadiusStatusMessage,
  exploreRadiusPresetById,
  featuresWithinRadius,
  formatExploreDistance,
  mapBoundsForRadius,
  matchesRadiusStatusMessage,
  placeOnlyStatusMessage,
  type ExploreNearbyFeature,
} from '../../../lib/map-experience/explore-place-radius';
import { DEGRADED_MODE_COPY } from '../../../lib/map-experience/snapshot-mode';
import {
  buildCountyChoroplethLevels,
  type CountyChoroplethLevel,
} from '../../../lib/map-experience/county-choropleth';
import { fetchCountyPopulationIndex } from '../../../lib/map-experience/load-county-population-index';
import { fetchStatePopulationIndex } from '../../../lib/map-experience/load-state-population-index';
import { buildStateChoroplethLevels } from '../../../lib/map-experience/state-choropleth';
import {
  buildExploreHref,
  isPopulationLayerMode,
  parseExploreSearchParams,
  viewportForState,
  type ExploreLayerMode,
  type ExploreMapBounds,
  type ExploreViewState,
  type ExploreViewport,
  type ExploreViewportFrame,
} from '../../../lib/map-experience/url-state';
import {
  applyExploreFilters,
  DEFAULT_EXPLORE_FILTERS,
  filterFeaturesInBounds,
  sortFeaturesForList,
  type ExploreFilterState,
} from '../../../lib/map-experience/filters';
import { useMapStage } from '../MapStage';
import { pickExploreEdgeSlice } from './explore-edge-catalog';
import {
  EXPLORE_SINGLE_PANEL_MEDIA,
  exploreInstrumentsPanelClassName,
  exploreNarrowExclusivePatch,
  exploreResultsPanelClassName,
  exploreStageChromeAttrs,
  resolveExploreLeftTab,
  shouldAcceptExploreServerViewState,
  type ExploreLeftTab,
} from './explore-panel-chrome';
import type { ExploreViewModel } from './explore-view-model';

function isExploreSinglePanelViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(EXPLORE_SINGLE_PANEL_MEDIA).matches;
}

export type ExploreMapExperienceProps = {
  readonly initial: ExploreViewModel;
};

const TRANSITION_FLAG = 'ds-map-transition';

/** Agent B (BB-098): read once on the client — hero sets this before `router.push`. */
function readHeroTransitionFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(TRANSITION_FLAG) === '1';
  } catch {
    return false;
  }
}

function clearHeroTransitionFlag(): void {
  try {
    window.sessionStorage.removeItem(TRANSITION_FLAG);
  } catch {
    // sessionStorage unavailable — flight and chrome still work; focus handoff is best-effort.
  }
}

/** Keeps a selected pin clear of the results rail when returning from a record page. */
const SELECTION_CAMERA_PADDING = { top: 72, bottom: 120, left: 48, right: 320 } as const;

function mergeViewState(
  base: ExploreViewState,
  patch: Partial<ExploreViewState> & {
    readonly clearSelected?: boolean;
    readonly clearState?: boolean;
    readonly clearEdge?: boolean;
    readonly clearDecade?: boolean;
    readonly clearRadius?: boolean;
    readonly clearNear?: boolean;
    readonly clearPopulationDecades?: boolean;
  },
): ExploreViewState {
  const next: ExploreViewState = {
    filters: patch.filters ?? base.filters,
    layerMode: patch.layerMode ?? base.layerMode,
    group: patch.group ?? base.group,
    lines: patch.lines ?? base.lines,
    showFilters: patch.showFilters ?? base.showFilters,
    showResults: patch.showResults ?? base.showResults,
    showKey: patch.showKey ?? base.showKey,
  };

  const withSelection = {
    ...next,
    ...resolveSelected(base, patch),
    ...resolveState(base, patch),
    ...resolveDecade(base, patch),
    ...resolveEdge(base, patch),
    ...resolvePopulationDecades(base, patch),
    ...resolveRadius(base, patch),
    ...resolveNear(base, patch),
  };

  if (patch.viewport) {
    return { ...withSelection, viewport: patch.viewport };
  }
  if (base.viewport) {
    return { ...withSelection, viewport: base.viewport };
  }
  return withSelection;
}

function resolveSelected(
  base: ExploreViewState,
  patch: Partial<ExploreViewState> & { readonly clearSelected?: boolean },
): Pick<ExploreViewState, 'selected'> {
  if (patch.clearSelected) return {};
  if (patch.selected) return { selected: patch.selected };
  if (base.selected) return { selected: base.selected };
  return {};
}

function resolveState(
  base: ExploreViewState,
  patch: Partial<ExploreViewState> & { readonly clearState?: boolean },
): Pick<ExploreViewState, 'state'> {
  if (patch.clearState) return {};
  if (patch.state) return { state: patch.state };
  if (base.state) return { state: base.state };
  return {};
}

function resolveDecade(
  base: ExploreViewState,
  patch: Partial<ExploreViewState> & { readonly clearDecade?: boolean },
): Pick<ExploreViewState, 'decade'> {
  if (patch.clearDecade) return {};
  if (patch.decade) return { decade: patch.decade };
  if (base.decade) return { decade: base.decade };
  return {};
}

function resolveEdge(
  base: ExploreViewState,
  patch: Partial<ExploreViewState> & { readonly clearEdge?: boolean },
): Pick<ExploreViewState, 'edge'> {
  if (patch.clearEdge) return {};
  if (patch.edge) return { edge: patch.edge };
  if (base.edge) return { edge: base.edge };
  return {};
}

function resolvePopulationDecades(
  base: ExploreViewState,
  patch: Partial<ExploreViewState> & { readonly clearPopulationDecades?: boolean },
): Pick<ExploreViewState, 'popGeo' | 'popDecade' | 'popFrom' | 'popTo'> {
  if (patch.clearPopulationDecades) return {};
  const layerMode = patch.layerMode ?? base.layerMode;
  if (layerMode === 'blackShare') {
    const popGeo = coercePopulationGeoForDecade(
      patch.popGeo ?? base.popGeo ?? DEFAULT_POPULATION_GEO,
      patch.popDecade ?? base.popDecade ?? defaultPopulationDecade(patch.popGeo ?? base.popGeo ?? DEFAULT_POPULATION_GEO),
    );
    const popDecade = patch.popDecade ?? base.popDecade ?? defaultPopulationDecade(popGeo);
    return { popGeo, popDecade };
  }
  if (layerMode === 'blackChange') {
    const popGeo = patch.popGeo ?? base.popGeo ?? DEFAULT_POPULATION_GEO;
    return {
      popGeo,
      ...((patch.popFrom ?? base.popFrom)
        ? { popFrom: patch.popFrom ?? base.popFrom! }
        : { popFrom: defaultPopulationChangeFrom(popGeo) }),
      ...((patch.popTo ?? base.popTo)
        ? { popTo: patch.popTo ?? base.popTo! }
        : { popTo: defaultPopulationChangeTo(popGeo) }),
    };
  }
  return {};
}

function resolveRadius(
  base: ExploreViewState,
  patch: Partial<ExploreViewState> & { readonly clearRadius?: boolean },
): Pick<ExploreViewState, 'radius'> {
  if (patch.clearRadius) return {};
  if (patch.radius) return { radius: patch.radius };
  if (base.radius) return { radius: base.radius };
  return {};
}

function resolveNear(
  base: ExploreViewState,
  patch: Partial<ExploreViewState> & { readonly clearNear?: boolean },
): Pick<ExploreViewState, 'near'> {
  if (patch.clearNear) return {};
  if (patch.near) return { near: patch.near };
  if (base.near) return { near: base.near };
  return {};
}

/** Facet render order matches how people narrow: what (kind/tone) → when (era) → about
 * (theme) → lifecycle (status) → evidence strength (confidence) → where (state). */
const FACET_ROWS: readonly {
  readonly key: keyof ExploreFilterState;
  readonly label: string;
  readonly field: 'kind' | 'tone' | 'era' | 'theme' | 'status' | 'confidence';
}[] = [
  { key: 'kind', label: 'Kind', field: 'kind' },
  { key: 'tone', label: 'Tone', field: 'tone' },
  { key: 'era', label: 'Era', field: 'era' },
  { key: 'theme', label: 'Theme', field: 'theme' },
  { key: 'status', label: 'Status', field: 'status' },
  { key: 'confidence', label: 'Confidence', field: 'confidence' },
];

/** Shareable explore href without live camera (panels/filters/selection only). */
function shareableExploreHref(viewState: ExploreViewState): string {
  const { viewport: _camera, ...shareable } = viewState;
  void _camera;
  return buildExploreHref(shareable);
}

export function ExploreMapExperience({ initial }: ExploreMapExperienceProps) {
  const stage = useMapStage();
  const [view, setView] = useState(initial);
  const filterRegionRef = useRef<HTMLDivElement | null>(null);
  const spotlightDialogRef = useRef<HTMLDialogElement | null>(null);
  // Agent B: latch hero→explore on first client render before any effect clears sessionStorage.
  const [fromHeroTransition] = useState(readHeroTransitionFlag);
  const [entering, setEntering] = useState(false);
  const [populationIndexLoaded, setPopulationIndexLoaded] = useState(false);
  const [countyPopulationIndex, setCountyPopulationIndex] = useState<
    Awaited<ReturnType<typeof fetchCountyPopulationIndex>> | undefined
  >(undefined);
  const [statePopulationIndex, setStatePopulationIndex] = useState<
    Awaited<ReturnType<typeof fetchStatePopulationIndex>> | undefined
  >(undefined);
  // Mirror of the latest committed view state for the debounced viewport handler below. React
  // may replay setState updater functions during render, so an updater must stay pure — the
  // handler needs the current view state OUTSIDE an updater to build the next URL.
  const viewStateRef = useRef(initial.viewState);
  /** Last href we wrote with replaceState — ignores RSC/prop echoes of our own panel writes. */
  const lastPushedHrefRef = useRef<string | null>(shareableExploreHref(initial.viewState));
  /** Live map camera — kept current via `viewport` subscription for close-camera bounce-back. */
  const liveViewportRef = useRef<ExploreViewport | undefined>(initial.viewState.viewport);
  /** Bounds used to scope the records list to what's geographically on the map. */
  const [listBounds, setListBounds] = useState<ExploreMapBounds | undefined>(undefined);
  /** First data patch after mount snaps; later decade/filter patches fade (continuous flow). */
  const isInitialDataApplyRef = useRef(true);
  const previousLayerModeRef = useRef(initial.viewState.layerMode);
  const previousLinesRef = useRef(initial.viewState.lines);
  const previousPopGeoRef = useRef(initial.viewState.popGeo ?? DEFAULT_POPULATION_GEO);
  /** Guards one-shot fly-to when applying place-search radius from a deep-linked URL. */
  const urlRadiusAppliedRef = useRef<string | null>(null);
  /** Camera before the most recent point-selection flight (hierarchical close target). */
  const preSelectViewportRef = useRef<ExploreViewport | undefined>(initial.viewState.viewport);
  /** Camera before the most recent place-search flight (cleared when place focus is dismissed). */
  const prePlaceSearchViewportRef = useRef<ExploreViewport | undefined>(undefined);
  /** Preferred Filters | Color key tab when both URL sections are visible. */
  const [leftTabPreference, setLeftTabPreference] = useState<ExploreLeftTab | null>(null);
  /**
   * Active place-search focus. Finite radius may annotate the list; the map catalog stays
   * unscoped so pins never disappear when framing a place.
   */
  const [placeSearchFocus, setPlaceSearchFocus] = useState<{
    readonly center: { readonly lat: number; readonly lng: number };
    readonly radiusMeters: number | null;
    readonly placeLabel: string;
    readonly radiusLabel: string;
    readonly within: readonly ExploreNearbyFeature[];
    readonly closest: readonly ExploreNearbyFeature[];
  } | null>(null);
  /** In-session Back stack for spotlight record navigation (not browser history). */
  const [sessionStack, setSessionStack] = useState<SessionStack>(() => createSessionStack());
  const [sessionRandomEnabled, setSessionRandomEnabled] = useState(false);

  useEffect(() => {
    const incomingHref = shareableExploreHref(initial.viewState);
    const liveHref = shareableExploreHref(
      parseExploreSearchParams(Object.fromEntries(new URLSearchParams(window.location.search))),
    );
    // Soft-nav / stale RSC echoes must not clobber panels open via replaceState.
    if (
      !shouldAcceptExploreServerViewState({
        incomingHref,
        lastPushedHref: lastPushedHrefRef.current,
        liveHref,
      })
    ) {
      return;
    }
    lastPushedHrefRef.current = incomingHref;
    setView(initial);
    viewStateRef.current = initial.viewState;
    urlRadiusAppliedRef.current = null;
  }, [initial]);

  useEffect(() => {
    const { radius, near, viewport } = view.viewState;
    if (!radius || radius === 'all' || !viewport) return;

    const preset = exploreRadiusPresetById(radius);
    if (preset.meters === null) return;

    const applyKey = `${radius}:${viewport.lat.toFixed(4)}:${viewport.lng.toFixed(4)}:${near ?? ''}`;
    if (urlRadiusAppliedRef.current === applyKey) return;
    urlRadiusAppliedRef.current = applyKey;

    const center = { lat: viewport.lat, lng: viewport.lng };
    const bounds = mapBoundsForRadius(center, preset.meters);
    stage.flyPreset('locality', { bounds });

    const catalog = applyExploreFilters(view.allFeatures, view.viewState.filters);
    const within = featuresWithinRadius(catalog, center, preset.meters);
    const closest = within.length > 0 ? [] : closestFeatures(catalog, center, 3);
    setPlaceSearchFocus({
      center,
      radiusMeters: preset.meters,
      placeLabel: near ?? 'This place',
      radiusLabel: preset.statusLabel,
      within,
      closest,
    });
    stage.setSearchCenterMarker({
      lng: center.lng,
      lat: center.lat,
      label: near ?? 'This place',
    });
  }, [
    stage,
    view.allFeatures,
    view.viewState.filters,
    view.viewState.near,
    view.viewState.radius,
    view.viewState.viewport,
  ]);

  useEffect(() => {
    viewStateRef.current = view.viewState;
  }, [view.viewState]);

  useEffect(() => {
    if (!isPopulationLayerMode(view.viewState.layerMode)) return;
    let cancelled = false;
    const popGeo = view.viewState.popGeo ?? DEFAULT_POPULATION_GEO;
    const loaders: Promise<void>[] = [];
    if (popGeo === 'county') {
      loaders.push(
        fetchCountyPopulationIndex().then((index) => {
          if (cancelled) return;
          setCountyPopulationIndex(index);
        }),
      );
    }
    if (popGeo === 'state') {
      loaders.push(
        fetchStatePopulationIndex().then((index) => {
          if (cancelled) return;
          setStatePopulationIndex(index);
        }),
      );
    }
    void Promise.all(loaders).then(() => {
      if (!cancelled) setPopulationIndexLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [view.viewState.layerMode, view.viewState.popGeo]);

  const countyChoroplethLevels = useMemo((): readonly CountyChoroplethLevel[] => {
    const { layerMode, popGeo, popDecade, popFrom, popTo } = view.viewState;
    const geo = popGeo ?? DEFAULT_POPULATION_GEO;
    if (geo !== 'county') return [];
    if (layerMode === 'blackShare') {
      return buildCountyChoroplethLevels({
        index: countyPopulationIndex,
        mode: 'blackShare',
        decade: (popDecade ?? '2020') as '2000' | '2010' | '2020',
      });
    }
    if (layerMode === 'blackChange') {
      return buildCountyChoroplethLevels({
        index: countyPopulationIndex,
        mode: 'blackChange',
        fromDecade: (popFrom ?? '2010') as '2000' | '2010' | '2020',
        toDecade: (popTo ?? '2020') as '2000' | '2010' | '2020',
      });
    }
    return [];
  }, [countyPopulationIndex, view.viewState]);

  const stateChoroplethLevels = useMemo(() => {
    const { layerMode, popGeo, popDecade, popFrom, popTo } = view.viewState;
    const geo = popGeo ?? DEFAULT_POPULATION_GEO;
    if (geo !== 'state') return [];
    if (layerMode === 'blackShare') {
      return buildStateChoroplethLevels({
        index: statePopulationIndex,
        mode: 'blackShare',
        decade: popDecade ?? '2020',
      });
    }
    if (layerMode === 'blackChange') {
      return buildStateChoroplethLevels({
        index: statePopulationIndex,
        mode: 'blackChange',
        fromDecade: popFrom ?? '2010',
        toDecade: popTo ?? '2020',
      });
    }
    return [];
  }, [statePopulationIndex, view.viewState]);

  /** Presence fills track the line-decade scrubber (active records that decade). */
  const presenceDensityByDecade = useMemo(
    () => buildActiveDensityByDecade(view.allFeatures),
    [view.allFeatures],
  );

  const presenceDensityLevels = useMemo(() => {
    if (view.viewState.layerMode !== 'presence') return [];
    const decade = view.viewState.decade;
    if (decade) {
      return presenceDensityByDecade.get(decade) ?? [];
    }
    return view.densityLevels;
  }, [
    presenceDensityByDecade,
    view.densityLevels,
    view.viewState.decade,
    view.viewState.layerMode,
  ]);

  // Agent B: hero landing — panel enter animation (reconcile skip is in the mount effect below).
  useEffect(() => {
    if (!fromHeroTransition) return;
    clearHeroTransitionFlag();
    setEntering(true);
    const duration = prefersReducedMotion() ? 0 : 280;
    const timer = window.setTimeout(() => setEntering(false), duration);
    return () => window.clearTimeout(timer);
  }, [fromHeroTransition]);

  const pushViewState = useCallback((next: ExploreViewState) => {
    // Shareable URL carries filters/selection/overlays — not the live camera.
    // Use history.replaceState (not router.replace): Next soft-navigation re-fetches RSC
    // and re-supplies `initial`, which previously fought panel open/close (open → replace →
    // setView(initial) thrash). Inbound `?lat=&lng=&zoom=` still parse for reconcile/radius.
    const href = shareableExploreHref(next);
    lastPushedHrefRef.current = href;
    window.history.replaceState(window.history.state, '', href);
  }, []);

  const filteredFeatures = useMemo(
    () => applyExploreFilters(view.allFeatures, view.viewState.filters, view.viewState.state),
    [view.allFeatures, view.viewState.filters, view.viewState.state],
  );

  const placeSearchCenter = placeSearchFocus?.center;
  const placeSearchRadiusMeters = placeSearchFocus?.radiusMeters;

  // Keep an active place-search ranking in sync with facet changes (same center/radius).
  useEffect(() => {
    if (!placeSearchCenter || placeSearchRadiusMeters === undefined) return;
    if (placeSearchRadiusMeters === null) {
      setPlaceSearchFocus((prev) => {
        if (!prev) return prev;
        return { ...prev, within: [], closest: [] };
      });
      return;
    }
    // Rank against the live facet set — never force a state lock from place search.
    const catalog = applyExploreFilters(view.allFeatures, view.viewState.filters);
    const within = featuresWithinRadius(catalog, placeSearchCenter, placeSearchRadiusMeters);
    const closest = within.length > 0 ? [] : closestFeatures(catalog, placeSearchCenter, 3);
    setPlaceSearchFocus((prev) => {
      if (!prev) return prev;
      return { ...prev, within, closest };
    });
  }, [view.allFeatures, view.viewState.filters, placeSearchCenter, placeSearchRadiusMeters]);

  // Resolve from the full catalog so a deep-linked `?selected=` still orients the copper ring
  // (and list highlight) even when the current facet set would hide that row.
  const selectedFeature = useMemo(
    () =>
      view.viewState.selected
        ? view.allFeatures.find(
            (feature) => feature.properties.entityId === view.viewState.selected,
          )
        : undefined,
    [view.allFeatures, view.viewState.selected],
  );

  const commitViewState = useCallback(
    (next: ExploreViewState) => {
      // Sync the ref before any async viewport debounce can merge — otherwise a map
      // pan after Hide / Select rewrites the URL from a stale panel/selection snapshot.
      viewStateRef.current = next;
      const edgeSlice = pickExploreEdgeSlice(view.edgeLineCatalog, next);
      const selectedEdge = next.edge
        ? edgeSlice.edges.find((edge) => edge.edgeId === next.edge)
        : undefined;
      const filtered = applyExploreFilters(view.allFeatures, next.filters, next.state);
      setView((current) => {
        const { selectedEdge: _previousEdge, ...rest } = current;
        void _previousEdge;
        return {
          ...rest,
          viewState: next,
          filteredFeatures: filtered,
          totalMatched: filtered.length,
          historyEdges: edgeSlice.edges,
          edgeLineCollection: edgeSlice.lineCollection,
          ...(selectedEdge ? { selectedEdge } : {}),
        };
      });
      pushViewState(next);
    },
    [pushViewState, view.allFeatures, view.edgeLineCatalog],
  );

  // Facets apply the moment they change — no filter card, no Apply button
  // (v5.1: pill selects inline with the content on primary surfaces).
  const handleFilterChange = useCallback(
    (key: keyof ExploreFilterState, value: string) => {
      commitViewState(
        mergeViewState(view.viewState, {
          filters: { ...view.viewState.filters, [key]: value },
        }),
      );
    },
    [commitViewState, view.viewState],
  );

  const handleClearFilters = useCallback(() => {
    commitViewState(
      mergeViewState(view.viewState, {
        filters: { ...DEFAULT_EXPLORE_FILTERS },
        clearState: true,
      }),
    );
  }, [commitViewState, view.viewState]);

  const handleStateFilterChange = useCallback(
    (value: string) => {
      if (value === 'all') {
        commitViewState(mergeViewState(view.viewState, { clearState: true }));
        return;
      }
      commitViewState(mergeViewState(view.viewState, { state: value }));
    },
    [commitViewState, view.viewState],
  );

  const hasActiveFilters =
    view.viewState.filters.era !== DEFAULT_EXPLORE_FILTERS.era ||
    view.viewState.filters.kind !== DEFAULT_EXPLORE_FILTERS.kind ||
    view.viewState.filters.tone !== DEFAULT_EXPLORE_FILTERS.tone ||
    view.viewState.filters.theme !== DEFAULT_EXPLORE_FILTERS.theme ||
    view.viewState.filters.status !== DEFAULT_EXPLORE_FILTERS.status ||
    view.viewState.filters.confidence !== DEFAULT_EXPLORE_FILTERS.confidence ||
    Boolean(view.viewState.state);

  // Deterministic reading order for the accessible list (chronological, undated
  // last). A finite place-search radius may scope the list; "All" and no place focus
  // keep the list matched to the live camera. Map pins always use filteredFeatures.
  const sortedListFeatures = useMemo(() => {
    if (placeSearchFocus && placeSearchFocus.radiusMeters !== null) {
      return sortFeaturesForList(placeSearchFocus.within.map((row) => row.feature));
    }
    const scoped = listBounds
      ? filterFeaturesInBounds(filteredFeatures, listBounds)
      : filteredFeatures;
    return sortFeaturesForList(scoped);
  }, [filteredFeatures, listBounds, placeSearchFocus]);

  // Every source-data-affecting slice of view state patches the shared canvas — never a style
  // rebuild the surface calls into (MapStage.patchData rebuilds the style internally).
  // After the first paint, patches dual-buffer crossdissolve so decade scrubbing and filter
  // changes morph presence colors / pins without emptying the plate. Layer-mode flips skip
  // morph: configOnly never syncs choropleth visibility/paint (blackShare / blackChange).
  useEffect(() => {
    const decade = view.viewState.decade;
    const layerModeChanged = previousLayerModeRef.current !== view.viewState.layerMode;
    previousLayerModeRef.current = view.viewState.layerMode;
    const historyEdgesToggled = previousLinesRef.current !== view.viewState.lines;
    previousLinesRef.current = view.viewState.lines;
    previousPopGeoRef.current = view.viewState.popGeo ?? DEFAULT_POPULATION_GEO;
    const fade = shouldMorphDecadeDataPatch({
      reducedMotion: prefersReducedMotion(),
      isInitialApply: isInitialDataApplyRef.current,
      layerModeChanged,
      populationLayerActive: isPopulationLayerMode(view.viewState.layerMode),
      historyEdgesToggled,
    });
    isInitialDataApplyRef.current = false;
    stage.patchData(
      {
        featureCollection: { type: 'FeatureCollection', features: filteredFeatures },
        jurisdictionAreaFeatures: view.source.jurisdictionAreaFeatures,
        layerMode: view.viewState.layerMode,
        popGeo: view.viewState.popGeo ?? DEFAULT_POPULATION_GEO,
        densityLevels: presenceDensityLevels,
        stateChoroplethLevels,
        countyChoroplethLevels: countyChoroplethLevels,
        clusteringEnabled: view.viewState.group,
        historyEdgesEnabled: view.viewState.lines,
        historyEdgeCollection: view.edgeLineCollection,
      },
      {
        ...(fade ? { fade: true } : {}),
        ...(decade ? { memorialDecade: decade } : { memorialComplete: true }),
      },
    );
  }, [
    stage,
    filteredFeatures,
    view.source.jurisdictionAreaFeatures,
    view.viewState.layerMode,
    view.viewState.group,
    view.viewState.decade,
    presenceDensityLevels,
    stateChoroplethLevels,
    countyChoroplethLevels,
    view.viewState.popGeo,
    view.viewState.lines,
    view.edgeLineCollection,
  ]);

  useEffect(() => {
    stage.applyViewState({
      selectedState: view.viewState.state,
      selectedEdge: view.viewState.edge,
      selectedEntity: view.viewState.selected,
    });
  }, [stage, view.viewState.state, view.viewState.edge, view.viewState.selected]);

  const reconcileCamera = useCallback(
    (viewState: ExploreViewState, mode: 'fly' | 'ease') => {
      if (viewState.selected) {
        const feature = view.allFeatures.find(
          (item) => item.properties.entityId === viewState.selected,
        );
        if (feature && feature.geometry.type === 'Point') {
          const [lng, lat] = feature.geometry.coordinates;
          stage.flyPreset(
            'point',
            { center: [lng, lat], zoom: CAMERA_POINT_ZOOM },
            { mode, padding: SELECTION_CAMERA_PADDING },
          );
          return;
        }
      }
      if (viewState.state) {
        const viewport = viewportForState(viewState.state);
        if (viewport) {
          stage.flyPreset(
            'state',
            { center: [viewport.lng, viewport.lat], zoom: viewport.zoom },
            { mode },
          );
          return;
        }
      }
      // Locate → explore deep links carry radius + viewport. Fit the search circle, not a
      // county-zoom point or the constructor CONUS frame.
      if (viewState.viewport && viewState.radius && viewState.radius !== 'all') {
        const radiusPreset = exploreRadiusPresetById(viewState.radius);
        if (radiusPreset.meters !== null) {
          stage.flyPreset(
            'locality',
            {
              bounds: mapBoundsForRadius(
                { lat: viewState.viewport.lat, lng: viewState.viewport.lng },
                radiusPreset.meters,
              ),
            },
            { mode },
          );
          return;
        }
      }
      if (viewState.viewport) {
        stage.flyPreset(
          'locality',
          {
            center: [viewState.viewport.lng, viewState.viewport.lat],
            zoom: viewState.viewport.zoom,
          },
          { mode },
        );
        return;
      }
      stage.flyPreset('national', { bounds: US_CONUS_BOUNDS }, { mode });
    },
    [stage, view.allFeatures],
  );

  // Deep link entry: reconcile the camera against the URL exactly once on mount (`easeTo`, never
  // a cinematic arc — arriving at a URL is a restore, not a descent). Skip when latched from hero
  // — its in-flight camera descent must not be interrupted (Agent B / ADR-017).
  // Drop leftover pan/zoom query noise from the address bar after restore; keep camera params
  // when a place-radius deep link still needs them for share/reload (`radius` + viewport).
  useEffect(() => {
    if (fromHeroTransition) return;
    reconcileCamera(initial.viewState, 'ease');
    const { viewport, radius, ...rest } = initial.viewState;
    if (viewport && !(radius && radius !== 'all')) {
      const cleaned = radius ? { ...rest, radius } : rest;
      viewStateRef.current = cleaned;
      setView((current) => ({ ...current, viewState: cleaned }));
      pushViewState(cleaned);
    }
    // Mount-only restore: intentional empty deps (camera + one-shot URL cleanup).
  }, []);

  // Back/forward: the URL changes under us via `popstate`. Restore the full shareable view
  // (filters/selection/toggles) and reconcile the camera — without rewriting the address bar
  // (it is already correct). Own `history.replaceState` calls never fire `popstate`.
  useEffect(() => {
    function handlePopState() {
      const raw = Object.fromEntries(new URLSearchParams(window.location.search).entries());
      const next = parseExploreSearchParams(raw);
      const edgeSlice = pickExploreEdgeSlice(view.edgeLineCatalog, next);
      const selectedEdge = next.edge
        ? edgeSlice.edges.find((edge) => edge.edgeId === next.edge)
        : undefined;
      const filtered = applyExploreFilters(view.allFeatures, next.filters, next.state);
      lastPushedHrefRef.current = shareableExploreHref(next);
      setView((current) => {
        const { selectedEdge: _previousEdge, ...rest } = current;
        void _previousEdge;
        return {
          ...rest,
          viewState: next,
          filteredFeatures: filtered,
          totalMatched: filtered.length,
          historyEdges: edgeSlice.edges,
          edgeLineCollection: edgeSlice.lineCollection,
          ...(selectedEdge ? { selectedEdge } : {}),
        };
      });
      viewStateRef.current = next;
      reconcileCamera(next, 'ease');
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [reconcileCamera, view.allFeatures, view.edgeLineCatalog]);

  // Agent B: after a hero dissolve landing, focus filters unless a pin was the engagement target.
  useEffect(() => {
    if (!fromHeroTransition || initial.viewState.selected || !initial.viewState.showFilters) return;
    filterRegionRef.current?.focus();
  }, [fromHeroTransition, initial.viewState.selected, initial.viewState.showFilters]);

  /** Hide collapses the whole instruments chassis — not only the active tab.
   * Previously HIDE toggled one of showFilters/showKey, so a second click was
   * required whenever both sections were URL-visible (the default). */
  const handleHideInstruments = useCallback(() => {
    setLeftTabPreference(null);
    commitViewState(mergeViewState(view.viewState, { showFilters: false, showKey: false }));
  }, [commitViewState, view.viewState]);

  const handleShowFilters = useCallback(() => {
    setLeftTabPreference('filters');
    const exclusive = isExploreSinglePanelViewport()
      ? exploreNarrowExclusivePatch({ opening: 'instruments' })
      : {};
    commitViewState(
      mergeViewState(view.viewState, { showFilters: true, showKey: false, ...exclusive }),
    );
  }, [commitViewState, view.viewState]);

  const handleHideResults = useCallback(() => {
    commitViewState(mergeViewState(view.viewState, { showResults: false }));
  }, [commitViewState, view.viewState]);

  const handleShowResults = useCallback(() => {
    const exclusive = isExploreSinglePanelViewport()
      ? exploreNarrowExclusivePatch({ opening: 'results' })
      : {};
    commitViewState(mergeViewState(view.viewState, { showResults: true, ...exclusive }));
  }, [commitViewState, view.viewState]);

  const handleShowKey = useCallback(() => {
    setLeftTabPreference('key');
    const exclusive = isExploreSinglePanelViewport()
      ? exploreNarrowExclusivePatch({ opening: 'instruments' })
      : {};
    commitViewState(
      mergeViewState(view.viewState, { showKey: true, showFilters: false, ...exclusive }),
    );
  }, [commitViewState, view.viewState]);

  const handleSelectLeftTab = useCallback(
    (tab: ExploreLeftTab) => {
      setLeftTabPreference(tab);
      const exclusive = isExploreSinglePanelViewport()
        ? exploreNarrowExclusivePatch({ opening: 'instruments' })
        : {};
      if (tab === 'filters') {
        commitViewState(
          mergeViewState(view.viewState, { showFilters: true, showKey: false, ...exclusive }),
        );
        return;
      }
      commitViewState(
        mergeViewState(view.viewState, { showKey: true, showFilters: false, ...exclusive }),
      );
    },
    [commitViewState, view.viewState],
  );

  const handleInstrumentsTabKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const active = resolveExploreLeftTab({
        showFilters: viewStateRef.current.showFilters,
        showKey: viewStateRef.current.showKey,
        preferredTab: leftTabPreference,
      });
      if (!active) return;
      event.preventDefault();
      const next: ExploreLeftTab =
        event.key === 'ArrowRight'
          ? active === 'filters'
            ? 'key'
            : 'filters'
          : active === 'key'
            ? 'filters'
            : 'key';
      handleSelectLeftTab(next);
      const focusId = next === 'filters' ? 'explore-tab-filters' : 'explore-tab-key';
      document.getElementById(focusId)?.focus();
    },
    [handleSelectLeftTab, leftTabPreference],
  );

  /** On tablet/phone, keep a single primary panel so sheets never stack over the map/zoom. */
  useEffect(() => {
    const media = window.matchMedia(EXPLORE_SINGLE_PANEL_MEDIA);
    const enforce = () => {
      if (!media.matches) return;
      const current = viewStateRef.current;
      const leftOpen = current.showFilters || current.showKey;
      // Only collapse a competing panel — never auto-open or flip instruments.
      if (leftOpen && current.showResults) {
        commitViewState(mergeViewState(current, { showResults: false }));
      }
    };
    enforce();
    media.addEventListener('change', enforce);
    return () => media.removeEventListener('change', enforce);
  }, [commitViewState]);

  const handleSelect = useCallback(
    (entityId: string, options?: { readonly skipSessionPush?: boolean }) => {
      // Stash the camera *before* the point flight so close can bounce one tier up
      // (county → state → country) instead of always dumping to CONUS / state filter.
      preSelectViewportRef.current = liveViewportRef.current ?? viewStateRef.current.viewport;
      const previousId = viewStateRef.current.selected;
      if (!options?.skipSessionPush && previousId && previousId !== entityId) {
        setSessionStack((stack) => sessionPush(stack, previousId));
      }
      const feature = view.allFeatures.find((item) => item.properties.entityId === entityId);
      if (feature && feature.geometry.type === 'Point') {
        const [lng, lat] = feature.geometry.coordinates;
        stage.flyPreset(
          'point',
          { center: [lng, lat], zoom: CAMERA_POINT_ZOOM },
          { padding: SELECTION_CAMERA_PADDING },
        );
      }
      commitViewState(mergeViewState(view.viewState, { selected: entityId, clearEdge: true }));
    },
    [commitViewState, stage, view.allFeatures, view.viewState],
  );

  const handleStateSelect = useCallback(
    (postalCode: string) => {
      const viewport = viewportForState(postalCode);
      if (viewport) {
        stage.flyPreset('state', { center: [viewport.lng, viewport.lat], zoom: viewport.zoom });
      }
      commitViewState(
        mergeViewState(view.viewState, {
          state: postalCode,
          clearSelected: true,
          clearEdge: true,
          ...(viewport ? { viewport } : {}),
        }),
      );
    },
    [commitViewState, stage, view.viewState],
  );

  const handleAddressResolved = useCallback(
    (payload: ExploreAddressResolvedPayload) => {
      const { target, radiusMeters, radiusLabel, radiusId, entityId } = payload;
      const prior = liveViewportRef.current ?? viewStateRef.current.viewport;
      prePlaceSearchViewportRef.current = prior;
      // Catalog picks also open a selected record — stash close-camera origin once.
      if (entityId) {
        preSelectViewportRef.current = prior;
      }
      const center = { lat: target.viewport.lat, lng: target.viewport.lng };

      // Fly to the place — never lock the state filter (that collapsed the map to a handful
      // of pins). Map catalog stays filteredFeatures only.
      if (radiusMeters === null) {
        stage.flyPreset(target.preset, {
          center: [target.viewport.lng, target.viewport.lat],
          zoom: target.viewport.zoom,
        });
        setPlaceSearchFocus({
          center,
          radiusMeters: null,
          placeLabel: target.label,
          radiusLabel,
          within: [],
          closest: [],
        });
      } else {
        const bounds = mapBoundsForRadius(center, radiusMeters);
        stage.flyPreset(target.preset === 'state' ? 'state' : 'locality', { bounds });
        const catalog = applyExploreFilters(view.allFeatures, view.viewState.filters);
        const within = featuresWithinRadius(catalog, center, radiusMeters);
        const closest = within.length > 0 ? [] : closestFeatures(catalog, center, 3);
        setPlaceSearchFocus({
          center,
          radiusMeters,
          placeLabel: target.label,
          radiusLabel,
          within,
          closest,
        });
      }

      stage.setSearchCenterMarker({
        lng: center.lng,
        lat: center.lat,
        label: target.label,
      });

      commitViewState(
        mergeViewState(view.viewState, {
          viewport: target.viewport,
          near: target.label,
          ...(radiusId !== 'all' ? { radius: radiusId } : { clearRadius: true }),
          ...(entityId ? { selected: entityId } : { clearSelected: true }),
          clearEdge: true,
        }),
      );
    },
    [commitViewState, stage, view.allFeatures, view.viewState],
  );

  const handleClearPlaceSearch = useCallback(() => {
    const prior = prePlaceSearchViewportRef.current;
    prePlaceSearchViewportRef.current = undefined;
    setPlaceSearchFocus(null);
    stage.clearSearchCenterMarker();
    urlRadiusAppliedRef.current = null;
    if (prior) {
      stage.flyPreset(
        'locality',
        { center: [prior.lng, prior.lat], zoom: prior.zoom },
        { mode: 'ease' },
      );
    }
    commitViewState(mergeViewState(view.viewState, { clearRadius: true, clearNear: true }));
  }, [commitViewState, stage, view.viewState]);

  const handleClearState = useCallback(() => {
    stage.flyPreset('national', { bounds: US_CONUS_BOUNDS }, { mode: 'ease' });
    commitViewState(mergeViewState(view.viewState, { clearState: true }));
  }, [commitViewState, stage, view.viewState]);

  const handleClearSelected = useCallback(() => {
    const selectedId = view.viewState.selected;
    const feature = selectedId
      ? view.allFeatures.find((item) => item.properties.entityId === selectedId)
      : undefined;
    const entityCenter =
      feature && feature.geometry.type === 'Point'
        ? ([feature.geometry.coordinates[0], feature.geometry.coordinates[1]] as const)
        : undefined;
    const target = resolveCloseCameraTarget({
      ...(preSelectViewportRef.current ? { preSelectViewport: preSelectViewportRef.current } : {}),
      ...(entityCenter ? { entityCenter } : {}),
      ...(view.viewState.state ? { stateFilter: view.viewState.state } : {}),
    });
    if (target.preset === 'national') {
      stage.flyPreset('national', { bounds: target.bounds }, { mode: 'ease' });
    } else {
      stage.flyPreset(
        target.preset,
        { center: target.center, zoom: target.zoom },
        { mode: 'ease' },
      );
    }
    commitViewState(mergeViewState(view.viewState, { clearSelected: true }));
  }, [commitViewState, stage, view.allFeatures, view.viewState]);

  const sessionOrderedIds = useMemo(() => {
    const fromList = sortedListFeatures.map((feature) => feature.properties.entityId);
    if (fromList.length > 1) {
      return fromList;
    }
    return filteredFeatures.map((feature) => feature.properties.entityId);
  }, [filteredFeatures, sortedListFeatures]);

  const handleSessionBack = useCallback(() => {
    const result = sessionBack(sessionStack);
    if (!result) {
      return;
    }
    setSessionStack(result.stack);
    handleSelect(result.entityId, { skipSessionPush: true });
  }, [handleSelect, sessionStack]);

  const handleSessionNext = useCallback(() => {
    const currentId = view.viewState.selected;
    if (!currentId) {
      return;
    }
    const nextId = pickNext({
      random: sessionRandomEnabled,
      currentId,
      orderedIds: sessionOrderedIds,
    });
    if (!nextId) {
      return;
    }
    setSessionStack((stack) => sessionPush(stack, currentId));
    handleSelect(nextId, { skipSessionPush: true });
  }, [handleSelect, sessionOrderedIds, sessionRandomEnabled, view.viewState.selected]);

  const handleSessionRandomToggle = useCallback(() => {
    setSessionRandomEnabled((previous) => !previous);
  }, []);

  const spotlightSessionNav = useMemo(() => {
    const currentId = view.viewState.selected;
    if (!currentId) {
      return undefined;
    }
    return {
      canBack: sessionCanBack(sessionStack),
      canNext: canPickNext({ currentId, orderedIds: sessionOrderedIds }),
      randomEnabled: sessionRandomEnabled,
      onBack: handleSessionBack,
      onNext: handleSessionNext,
      onRandomToggle: handleSessionRandomToggle,
    };
  }, [
    handleSessionBack,
    handleSessionNext,
    handleSessionRandomToggle,
    sessionOrderedIds,
    sessionRandomEnabled,
    sessionStack,
    view.viewState.selected,
  ]);

  const handleLayerModeChange = useCallback(
    (layerMode: ExploreLayerMode) => {
      if (layerMode === 'blackShare') {
        const popGeo = view.viewState.popGeo ?? DEFAULT_POPULATION_GEO;
        commitViewState(
          mergeViewState(view.viewState, {
            layerMode,
            popGeo,
            popDecade: view.viewState.popDecade ?? defaultPopulationDecade(popGeo),
          }),
        );
        return;
      }
      if (layerMode === 'blackChange') {
        const popGeo = view.viewState.popGeo ?? DEFAULT_POPULATION_GEO;
        commitViewState(
          mergeViewState(view.viewState, {
            layerMode,
            popGeo,
            popFrom: view.viewState.popFrom ?? defaultPopulationChangeFrom(popGeo),
            popTo: view.viewState.popTo ?? defaultPopulationChangeTo(popGeo),
          }),
        );
        return;
      }
      commitViewState(
        mergeViewState(view.viewState, {
          layerMode,
          clearPopulationDecades: true,
        }),
      );
    },
    [commitViewState, view.viewState],
  );

  const handlePopGeoChange = useCallback(
    (popGeo: ExplorePopulationGeo) => {
      const { layerMode } = view.viewState;
      if (layerMode === 'blackShare') {
        const popDecade = view.viewState.popDecade ?? defaultPopulationDecade(popGeo);
        commitViewState(
          mergeViewState(view.viewState, {
            layerMode,
            popGeo,
            popDecade,
          }),
        );
        return;
      }
      if (layerMode === 'blackChange') {
        commitViewState(
          mergeViewState(view.viewState, {
            layerMode,
            popGeo,
            popFrom: view.viewState.popFrom ?? defaultPopulationChangeFrom(popGeo),
            popTo: view.viewState.popTo ?? defaultPopulationChangeTo(popGeo),
          }),
        );
      }
    },
    [commitViewState, view.viewState],
  );

  const handlePopDecadeChange = useCallback(
    (popDecade: string) => {
      const popGeo = coercePopulationGeoForDecade(
        view.viewState.popGeo ?? DEFAULT_POPULATION_GEO,
        popDecade,
      );
      commitViewState(
        mergeViewState(view.viewState, { layerMode: 'blackShare', popGeo, popDecade }),
      );
    },
    [commitViewState, view.viewState],
  );

  const handlePopFromChange = useCallback(
    (popFrom: string) => {
      commitViewState(
        mergeViewState(view.viewState, {
          layerMode: 'blackChange',
          popGeo: view.viewState.popGeo ?? DEFAULT_POPULATION_GEO,
          popFrom,
        }),
      );
    },
    [commitViewState, view.viewState],
  );

  const handlePopToChange = useCallback(
    (popTo: string) => {
      const popGeo = coercePopulationGeoForDecade(
        view.viewState.popGeo ?? DEFAULT_POPULATION_GEO,
        popTo,
      );
      commitViewState(
        mergeViewState(view.viewState, { layerMode: 'blackChange', popGeo, popTo }),
      );
    },
    [commitViewState, view.viewState],
  );

  const handleGroupToggle = useCallback(() => {
    commitViewState(mergeViewState(view.viewState, { group: !view.viewState.group }));
  }, [commitViewState, view.viewState]);

  const handleLinesToggle = useCallback(() => {
    const lines = !view.viewState.lines;
    commitViewState(
      mergeViewState(view.viewState, {
        lines,
        ...(lines ? {} : { clearEdge: true, clearDecade: true }),
      }),
    );
  }, [commitViewState, view.viewState]);

  const handleDecadeSelect = useCallback(
    (decade: string | undefined) => {
      commitViewState(
        mergeViewState(view.viewState, {
          lines: true,
          clearEdge: true,
          ...(decade ? { decade } : { clearDecade: true }),
        }),
      );
    },
    [commitViewState, view.viewState],
  );

  const handleEdgeSelect = useCallback(
    (edgeId: string) => {
      commitViewState(
        mergeViewState(view.viewState, { edge: edgeId, lines: true, clearSelected: true }),
      );
    },
    [commitViewState, view.viewState],
  );

  const handleCloseEdge = useCallback(() => {
    commitViewState(mergeViewState(view.viewState, { clearEdge: true }));
  }, [commitViewState, view.viewState]);

  // Spotlight: native <dialog> for focus trap + restore-focus (same contract as @repo/ui Dialog).
  const spotlightOpen = Boolean(view.selectedEdge) || Boolean(selectedFeature);
  const dismissSpotlight = view.selectedEdge ? handleCloseEdge : handleClearSelected;
  useEffect(() => {
    if (!spotlightOpen) return undefined;
    const node = spotlightDialogRef.current;
    if (!node) return undefined;
    if (!node.open) node.showModal();
    const frame = window.requestAnimationFrame(() => {
      node.querySelector<HTMLElement>('article, button.ds-nc__close, [tabindex], button')?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (node.open) node.close();
    };
  }, [spotlightOpen]);

  const handleViewportChange = useCallback((frame: ExploreViewportFrame) => {
    const viewport: ExploreViewport = {
      lat: frame.lat,
      lng: frame.lng,
      zoom: frame.zoom,
    };
    liveViewportRef.current = viewport;
    // While a record is open the camera sits at point zoom — keep the list scoped to the
    // pre-select framing so selecting a pin does not empty the records rail.
    if (!viewStateRef.current.selected) {
      preSelectViewportRef.current = viewport;
      setListBounds((previous) =>
        previous &&
        previous.west === frame.bounds.west &&
        previous.south === frame.bounds.south &&
        previous.east === frame.bounds.east &&
        previous.north === frame.bounds.north
          ? previous
          : frame.bounds,
      );
    }
    // Camera stays in-memory only — pan/zoom must not rewrite the address bar.
  }, []);

  // Canvas event wiring — resubscribes whenever a handler's closed-over view state changes
  // (cheap Set add/delete; the alternative, stale closures, is worse).
  useEffect(() => {
    const unsubscribers = [
      stage.subscribe('select', handleSelect),
      stage.subscribe('stateSelect', handleStateSelect),
      stage.subscribe('edgeSelect', handleEdgeSelect),
      stage.subscribe('viewport', handleViewportChange),
    ];
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [stage, handleSelect, handleStateSelect, handleEdgeSelect, handleViewportChange]);

  const degradedCopy = stage.mapAvailable ? null : DEGRADED_MODE_COPY.map_canvas_unavailable;
  const selectedStateName = view.viewState.state
    ? findUsStateByPostalCode(view.viewState.state)?.name
    : undefined;
  const filtersVisible = view.viewState.showFilters;
  const resultsVisible = view.viewState.showResults;
  const keyVisible = view.viewState.showKey;
  const leftTab = resolveExploreLeftTab({
    showFilters: filtersVisible,
    showKey: keyVisible,
    preferredTab: leftTabPreference,
  });
  const instrumentsVisible = leftTab !== null;
  const resultsDimmed = Boolean(view.selectedEdge || selectedFeature);

  const listProps = {
    features: sortedListFeatures,
    labelledBy: 'explore-results-heading',
    onSelect: handleSelect,
    ...(view.viewState.selected ? { selectedId: view.viewState.selected } : {}),
  };

  const stageChrome = exploreStageChromeAttrs({
    instrumentsVisible,
    leftTab,
    resultsVisible,
  });

  const hideActiveAriaLabel = 'Hide map instruments';
  const hideActiveHandler = handleHideInstruments;

  return (
    /* Instruments follow the site theme (light/dark) — map plate syncs via MapStage. */
    <div
      className={entering ? 'ds-explore-stage ds-explore-stage--entering' : 'ds-explore-stage'}
      data-map-journey={entering ? 'entering' : 'explore'}
      {...stageChrome}
    >
      {!stage.mapAvailable && degradedCopy ? (
        <div className="ds-explore-stage__notice">
          <Notice tone="warning" title="Map unavailable">
            {degradedCopy}
          </Notice>
        </div>
      ) : null}

      <div
        className={exploreInstrumentsPanelClassName({ visible: instrumentsVisible })}
        ref={filterRegionRef}
        tabIndex={instrumentsVisible ? -1 : undefined}
        aria-label="Map instruments"
        {...(instrumentsVisible ? {} : { hidden: true })}
      >
        <div className="ds-explore-stage__panel-header">
          <div
            className="ds-explore-stage__tabs"
            role="tablist"
            aria-label="Map instruments"
            onKeyDown={handleInstrumentsTabKeyDown}
          >
            <button
              type="button"
              role="tab"
              id="explore-tab-filters"
              className="ds-explore-stage__tab"
              aria-selected={leftTab === 'filters'}
              aria-controls="explore-tabpanel-filters"
              tabIndex={leftTab === 'filters' ? 0 : -1}
              onClick={() => handleSelectLeftTab('filters')}
            >
              Filters
            </button>
            <button
              type="button"
              role="tab"
              id="explore-tab-key"
              className="ds-explore-stage__tab"
              aria-selected={leftTab === 'key'}
              aria-controls="explore-tabpanel-key"
              tabIndex={leftTab === 'key' ? 0 : -1}
              onClick={() => handleSelectLeftTab('key')}
            >
              Color key
            </button>
          </div>
          <button
            type="button"
            className="ds-button ds-button--secondary ds-button--compact ds-explore-stage__panel-hide"
            aria-label={hideActiveAriaLabel}
            onClick={hideActiveHandler}
          >
            Hide
          </button>
        </div>

        <div
          className="ds-explore-stage__tabpanel"
          role="tabpanel"
          id="explore-tabpanel-filters"
          aria-labelledby="explore-tab-filters"
          {...(leftTab === 'filters' ? {} : { hidden: true })}
        >
          <p
            className="ds-explore-stage__panel-title ds-visually-hidden"
            id="explore-facets-heading"
          >
            Filters
          </p>
          <ExploreAddressSearch
            onResolved={handleAddressResolved}
            catalogFeatures={view.allFeatures}
          />
          {placeSearchFocus ? (
            <div className="ds-explore-place-focus" role="status" aria-live="polite">
              {placeSearchFocus.radiusMeters === null ? (
                <p className="ds-sans ds-explore-place-focus__message">
                  {placeOnlyStatusMessage(placeSearchFocus.placeLabel)}
                </p>
              ) : placeSearchFocus.within.length > 0 ? (
                <p className="ds-sans ds-explore-place-focus__message">
                  {matchesRadiusStatusMessage({
                    count: placeSearchFocus.within.length,
                    placeLabel: placeSearchFocus.placeLabel,
                    radiusLabel: placeSearchFocus.radiusLabel,
                  })}
                </p>
              ) : (
                <>
                  <p className="ds-sans ds-explore-place-focus__message">
                    {emptyRadiusStatusMessage({
                      placeLabel: placeSearchFocus.placeLabel,
                      radiusLabel: placeSearchFocus.radiusLabel,
                    })}
                  </p>
                  {placeSearchFocus.closest.length > 0 ? (
                    <ul className="ds-explore-place-focus__closest">
                      {placeSearchFocus.closest.map((row) => (
                        <li key={row.feature.properties.entityId}>
                          <button
                            type="button"
                            className="ds-explore-place-focus__closest-btn"
                            onClick={() => {
                              handleSelect(row.feature.properties.entityId);
                              setPlaceSearchFocus(null);
                            }}
                          >
                            <span className="ds-explore-place-focus__closest-name">
                              {row.feature.properties.displayName}
                            </span>
                            <span className="ds-mono ds-explore-place-focus__closest-dist">
                              {formatExploreDistance(row.distanceMeters)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
              <button
                type="button"
                className="ds-button ds-button--secondary ds-button--compact"
                onClick={handleClearPlaceSearch}
              >
                Clear place
              </button>
            </div>
          ) : null}
          <div className="ds-explore__facets" role="group" aria-labelledby="explore-facets-heading">
            {FACET_ROWS.map(({ key, label, field }) => (
              <label
                className="ds-pill-select ds-explore__facet"
                key={key}
                htmlFor={`explore-${key}`}
              >
                <MetaFieldLabel field={field} as="span" className="ds-pill-select__label">
                  {label}
                </MetaFieldLabel>
                <select
                  className="ds-pill-select__control"
                  id={`explore-${key}`}
                  value={view.viewState.filters[key]}
                  onChange={(event) => handleFilterChange(key, event.currentTarget.value)}
                >
                  {view.facetOptions[key].map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {view.facetOptions.state.length > 1 ? (
              <label className="ds-pill-select ds-explore__facet" htmlFor="explore-state">
                <MetaFieldLabel field="where" as="span" className="ds-pill-select__label">
                  Where
                </MetaFieldLabel>
                <select
                  className="ds-pill-select__control"
                  id="explore-state"
                  value={view.viewState.state ?? 'all'}
                  onChange={(event) => handleStateFilterChange(event.currentTarget.value)}
                >
                  {view.facetOptions.state.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {hasActiveFilters ? (
              <button
                type="button"
                className="ds-button ds-button--secondary ds-button--compact ds-explore__clear-filters"
                onClick={handleClearFilters}
              >
                Clear filters
              </button>
            ) : null}
          </div>

          <div className="ds-explore-stage__toolbar">
            <LayerModelControl
              layerMode={view.viewState.layerMode}
              popGeo={view.viewState.popGeo ?? DEFAULT_POPULATION_GEO}
              {...(view.viewState.popDecade ? { popDecade: view.viewState.popDecade } : {})}
              {...(view.viewState.popFrom ? { popFrom: view.viewState.popFrom } : {})}
              {...(view.viewState.popTo ? { popTo: view.viewState.popTo } : {})}
              onLayerModeChange={handleLayerModeChange}
              onPopGeoChange={handlePopGeoChange}
              onPopDecadeChange={handlePopDecadeChange}
              onPopFromChange={handlePopFromChange}
              onPopToChange={handlePopToChange}
            />
            {isPopulationLayerMode(view.viewState.layerMode) &&
            populationIndexLoaded &&
            (view.viewState.popGeo ?? DEFAULT_POPULATION_GEO) === 'county' &&
            !countyPopulationIndex ? (
              <p className="ds-sans ds-explore__settings-note">
                County population data is not loaded yet — choropleth tiers stay neutral until the
                static index is available.
              </p>
            ) : null}
            {isPopulationLayerMode(view.viewState.layerMode) &&
            populationIndexLoaded &&
            (view.viewState.popGeo ?? DEFAULT_POPULATION_GEO) === 'state' &&
            !statePopulationIndex ? (
              <p className="ds-sans ds-explore__settings-note">
                State population data is not loaded yet — state fills stay neutral until the static
                index is available.
              </p>
            ) : null}
            <GroupingToggle enabled={view.viewState.group} onToggle={handleGroupToggle} />
            <details className="ds-explore-stage__disclosure" open={view.viewState.lines}>
              <summary className="ds-explore-stage__disclosure-summary">Map settings</summary>
              <div className="ds-explore__settings-body">
                <fieldset className="ds-explore__settings-fieldset">
                  <legend className="ds-sans">Relationship lines</legend>
                  <button
                    type="button"
                    className="ds-button"
                    aria-pressed={view.viewState.lines}
                    onClick={handleLinesToggle}
                  >
                    Lines: {view.viewState.lines ? 'on' : 'off'}
                  </button>
                  <p className="ds-sans ds-explore__settings-note">
                    Evidence-backed History connections only. Campus-shared endpoints show a short
                    display stub.
                  </p>
                </fieldset>

                {view.viewState.lines ? (
                  <fieldset className="ds-explore__settings-fieldset">
                    <legend className="ds-sans">Decade</legend>
                    <div className="ds-explore__decade-row" role="tablist" aria-label="Line decade">
                      <button
                        type="button"
                        role="tab"
                        className="ds-button"
                        aria-selected={!view.viewState.decade}
                        onClick={() => handleDecadeSelect(undefined)}
                      >
                        All time
                      </button>
                      {view.availableDecades.map((decade) => (
                        <button
                          key={decade}
                          type="button"
                          role="tab"
                          className="ds-button"
                          aria-selected={view.viewState.decade === decade}
                          onClick={() => handleDecadeSelect(decade)}
                        >
                          {decade}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                <p className="ds-sans">
                  <Link href="/history">Open the full history graph</Link> for the decade narrative
                  panel.
                </p>
              </div>
            </details>
            {view.viewState.state ? (
              <button
                type="button"
                className="ds-button ds-button--secondary ds-button--compact"
                onClick={handleClearState}
              >
                Clear state
              </button>
            ) : null}
            {view.viewState.selected && selectedFeature ? (
              <button
                type="button"
                className="ds-button ds-button--secondary ds-button--compact"
                onClick={handleClearSelected}
              >
                Clear map focus
              </button>
            ) : null}
          </div>
        </div>

        <div
          className="ds-explore-stage__tabpanel"
          role="tabpanel"
          id="explore-tabpanel-key"
          aria-labelledby="explore-tab-key"
          {...(leftTab === 'key' ? {} : { hidden: true })}
        >
          <MapExperienceLegend
            layerMode={view.viewState.layerMode}
            popGeo={view.viewState.popGeo ?? DEFAULT_POPULATION_GEO}
            embedded
          />
        </div>
      </div>

      {!instrumentsVisible || !resultsVisible ? (
        <div className="ds-explore-stage__restore-dock" aria-label="Show map panels">
          {!instrumentsVisible ? (
            <>
              <button
                type="button"
                className="ds-button ds-button--secondary ds-explore-stage__panel-restore"
                aria-label="Show filters"
                onClick={handleShowFilters}
              >
                Filters
              </button>
              <button
                type="button"
                className="ds-button ds-button--secondary ds-explore-stage__panel-restore"
                aria-label="Show key"
                onClick={handleShowKey}
              >
                Color key
              </button>
            </>
          ) : null}
          {!resultsVisible ? (
            <button
              type="button"
              className="ds-button ds-button--secondary ds-explore-stage__panel-restore ds-explore-stage__panel-restore--results"
              aria-label="Show records"
              onClick={handleShowResults}
            >
              Records
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={exploreResultsPanelClassName({ visible: resultsVisible, dimmed: resultsDimmed })}
        {...(resultsVisible ? {} : { hidden: true })}
      >
        <div className="ds-explore-stage__panel-header">
          {/* The count labels the list it sits above — oldest records first. */}
          <p className="ds-sans ds-explore__results-count" id="explore-results-heading">
            {placeSearchFocus &&
            placeSearchFocus.radiusMeters !== null &&
            placeSearchFocus.within.length === 0
              ? `No documented records within ${placeSearchFocus.radiusLabel} of ${placeSearchFocus.placeLabel}`
              : placeSearchFocus && placeSearchFocus.radiusMeters !== null
                ? `${sortedListFeatures.length} documented record${
                    sortedListFeatures.length === 1 ? '' : 's'
                  } within ${placeSearchFocus.radiusLabel} of ${placeSearchFocus.placeLabel}`
                : `${sortedListFeatures.length} documented record${
                    sortedListFeatures.length === 1 ? '' : 's'
                  }${selectedStateName ? ` in ${selectedStateName}` : ' in view'}`}
            {view.viewState.lines
              ? ` · ${view.edgeLineCollection.features.length} connection${
                  view.edgeLineCollection.features.length === 1 ? '' : 's'
                }`
              : ''}
            {!(
              placeSearchFocus &&
              placeSearchFocus.radiusMeters !== null &&
              placeSearchFocus.within.length === 0
            )
              ? ' · oldest first'
              : ''}
          </p>
          <button
            type="button"
            className="ds-button ds-button--secondary ds-button--compact ds-explore-stage__panel-hide"
            aria-label="Hide records"
            onClick={handleHideResults}
          >
            Hide records
          </button>
        </div>
        <SynchronizedResultList {...listProps} />
      </div>

      {spotlightOpen ? (
        <dialog
          ref={spotlightDialogRef}
          className="ds-explore-stage__spotlight"
          aria-label={view.selectedEdge ? 'Selected connection' : 'Selected record'}
          onCancel={(event) => {
            event.preventDefault();
            dismissSpotlight();
          }}
        >
          <button
            type="button"
            className="ds-explore-stage__spotlight-scrim"
            aria-label={view.selectedEdge ? 'Dismiss connection panel' : 'Dismiss record preview'}
            onClick={dismissSpotlight}
          />
          <div className="ds-explore-stage__spotlight-panel">
            {view.selectedEdge ? (
              <HistoryEdgePanel edge={view.selectedEdge} onClose={handleCloseEdge} />
            ) : selectedFeature ? (
              <NarrativeCard
                feature={selectedFeature}
                onClose={handleClearSelected}
                {...(spotlightSessionNav ? { sessionNav: spotlightSessionNav } : {})}
              />
            ) : null}
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
