'use client';

/**
 * Client orchestrator for `/explore`. Wires the shared `MapStage` (via `useMapStage()`
 * instead of mounting its own canvas), the synchronized accessible list, map data model
 * picker (record presence | Black population share | share change), nearby-points grouping
 * nearby-points grouping toggle, relationship lines, decade settings, filter form, and
 * shareable URL state. Pin or list selection opens a preview narrative card in the spotlight
 * shell; the full record is one CTA away at `/entity/[id]`. `?selected=` is shareable preview
 * state (e.g. return from “View on map”). History edge clicks still open a connection panel.
 * The server-rendered snapshot catalog is the
 * source of truth; `/explore/api` refine is optional progressive enhancement when App Check
 * is configured.
 *
 * Camera: deep links and back/forward reconcile the camera from the URL via `easeTo`
 * (`reconcileCamera`, run once on mount and again on every `popstate`) never a raw default
 * flight (ADR-017). Selecting a pin flies briefly then opens the preview card. Closing the
 * card eases one geographic tier up (county → state → country) from the pre-select camera,
 * never a jump cut to full CONUS when the reader was already in a tighter frame.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Notice } from '@repo/ui';
import { US_CONUS_BOUNDS, findUsStateByPostalCode } from '@repo/domain/map/geography';
import type { CensusPopulationDecade } from '@repo/domain/map/county-population';
import { HistoryEdgePanel } from '../../../components/history/HistoryEdgePanel';
import { LayerModelControl } from '../../../components/map-experience/LayerModelControl';
import { GroupingToggle } from '../../../components/map-experience/GroupingToggle';
import { MapExperienceLegend } from '../../../components/map-experience/MapExperienceLegend';
import { NarrativeCard } from '../../../components/map-experience/NarrativeCard';
import { SynchronizedResultList } from '../../../components/map-experience/SynchronizedResultList';
import { CAMERA_POINT_ZOOM, prefersReducedMotion } from '../../../lib/map-experience/camera-presets';
import { resolveCloseCameraTarget } from '../../../lib/map-experience/close-camera';
import { DEGRADED_MODE_COPY } from '../../../lib/map-experience/snapshot-mode';
import {
  buildCountyChoroplethLevels,
  type CountyChoroplethLevel,
} from '../../../lib/map-experience/county-choropleth';
import { fetchCountyPopulationIndex } from '../../../lib/map-experience/load-county-population-index';
import {
  buildExploreHref,
  isPopulationLayerMode,
  parseExploreSearchParams,
  viewportForState,
  type ExploreLayerMode,
  type ExploreViewState,
  type ExploreViewport,
} from '../../../lib/map-experience/url-state';
import {
  applyExploreFilters,
  sortFeaturesForList,
  type ExploreFilterState,
} from '../../../lib/map-experience/filters';
import { useMapStage } from '../MapStage';
import { pickExploreEdgeSlice } from './explore-edge-catalog';
import {
  exploreFiltersPanelClassName,
  exploreResultsPanelClassName,
} from './explore-panel-chrome';
import type { ExploreViewModel } from './explore-view-model';

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
  },
): ExploreViewState {
  const next: ExploreViewState = {
    filters: patch.filters ?? base.filters,
    layerMode: patch.layerMode ?? base.layerMode,
    group: patch.group ?? base.group,
    lines: patch.lines ?? base.lines,
    showFilters: patch.showFilters ?? base.showFilters,
    showResults: patch.showResults ?? base.showResults,
  };

  const withSelection = {
    ...next,
    ...resolveSelected(base, patch),
    ...resolveState(base, patch),
    ...resolveDecade(base, patch),
    ...resolveEdge(base, patch),
    ...resolvePopulationDecades(base, patch),
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
): Pick<ExploreViewState, 'popDecade' | 'popFrom' | 'popTo'> {
  if (patch.clearPopulationDecades) return {};
  const layerMode = patch.layerMode ?? base.layerMode;
  if (layerMode === 'blackShare') {
    const popDecade = patch.popDecade ?? base.popDecade;
    return popDecade ? { popDecade } : {};
  }
  if (layerMode === 'blackChange') {
    return {
      ...(patch.popFrom ?? base.popFrom ? { popFrom: patch.popFrom ?? base.popFrom! } : {}),
      ...(patch.popTo ?? base.popTo ? { popTo: patch.popTo ?? base.popTo! } : {}),
    };
  }
  return {};
}

/** Facet render order matches how people actually narrow: what (kind) → when
 * (era) → about (theme) → how solid (confidence). One row each, auto-applying. */
const FACET_ROWS: readonly { readonly key: keyof ExploreFilterState; readonly label: string }[] = [
  { key: 'kind', label: 'Kind' },
  { key: 'era', label: 'Era' },
  { key: 'theme', label: 'Theme' },
  { key: 'confidence', label: 'Confidence' },
];

export function ExploreMapExperience({ initial }: ExploreMapExperienceProps) {
  const router = useRouter();
  const stage = useMapStage();
  const [view, setView] = useState(initial);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterRegionRef = useRef<HTMLDivElement | null>(null);
  const spotlightRef = useRef<HTMLDivElement | null>(null);
  // Agent B: latch hero→explore on first client render before any effect clears sessionStorage.
  const [fromHeroTransition] = useState(readHeroTransitionFlag);
  const [entering, setEntering] = useState(false);
  const [populationIndexLoaded, setPopulationIndexLoaded] = useState(false);
  const [populationIndex, setPopulationIndex] = useState<
    Awaited<ReturnType<typeof fetchCountyPopulationIndex>> | undefined
  >(undefined);
  // Mirror of the latest committed view state for the debounced viewport handler below. React
  // may replay setState updater functions during render, so an updater must stay pure — the
  // handler needs the current view state OUTSIDE an updater to build the next URL.
  const viewStateRef = useRef(initial.viewState);
  /** Live map camera — kept current via `viewport` subscription for close-camera bounce-back. */
  const liveViewportRef = useRef<ExploreViewport | undefined>(initial.viewState.viewport);
  /** Camera before the most recent point-selection flight (hierarchical close target). */
  const preSelectViewportRef = useRef<ExploreViewport | undefined>(initial.viewState.viewport);

  useEffect(() => {
    setView(initial);
  }, [initial]);

  useEffect(() => {
    viewStateRef.current = view.viewState;
  }, [view.viewState]);

  useEffect(() => {
    if (!isPopulationLayerMode(view.viewState.layerMode)) return;
    let cancelled = false;
    void fetchCountyPopulationIndex().then((index) => {
      if (cancelled) return;
      setPopulationIndex(index);
      setPopulationIndexLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [view.viewState.layerMode]);

  const countyChoroplethLevels = useMemo((): readonly CountyChoroplethLevel[] => {
    const { layerMode, popDecade, popFrom, popTo } = view.viewState;
    if (layerMode === 'blackShare') {
      return buildCountyChoroplethLevels({
        index: populationIndex,
        mode: 'blackShare',
        ...(popDecade ? { decade: popDecade } : {}),
      });
    }
    if (layerMode === 'blackChange') {
      return buildCountyChoroplethLevels({
        index: populationIndex,
        mode: 'blackChange',
        ...(popFrom ? { fromDecade: popFrom } : {}),
        ...(popTo ? { toDecade: popTo } : {}),
      });
    }
    return [];
  }, [populationIndex, view.viewState]);

  // Agent B: hero landing — panel enter animation (reconcile skip is in the mount effect below).
  useEffect(() => {
    if (!fromHeroTransition) return;
    clearHeroTransitionFlag();
    setEntering(true);
    const duration = prefersReducedMotion() ? 0 : 280;
    const timer = window.setTimeout(() => setEntering(false), duration);
    return () => window.clearTimeout(timer);
  }, [fromHeroTransition]);

  const pushViewState = useCallback(
    (next: ExploreViewState) => {
      router.replace(buildExploreHref(next), { scroll: false });
    },
    [router],
  );

  const filteredFeatures = useMemo(
    () => applyExploreFilters(view.allFeatures, view.viewState.filters, view.viewState.state),
    [view.allFeatures, view.viewState.filters, view.viewState.state],
  );

  // Resolve from the full catalog so a deep-linked `?selected=` still orients the copper ring
  // (and list highlight) even when the current facet set would hide that row.
  const selectedFeature = useMemo(
    () =>
      view.viewState.selected
        ? view.allFeatures.find((feature) => feature.properties.entityId === view.viewState.selected)
        : undefined,
    [view.allFeatures, view.viewState.selected],
  );

  const commitViewState = useCallback(
    (next: ExploreViewState) => {
      const edgeSlice = pickExploreEdgeSlice(view.edgeLineCatalog, next);
      const selectedEdge = next.edge ? edgeSlice.edges.find((edge) => edge.edgeId === next.edge) : undefined;
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

  // Deterministic reading order for the accessible list (chronological, undated
  // last) — the GL canvas keeps source order; paint order is not reading order.
  const sortedListFeatures = useMemo(() => sortFeaturesForList(filteredFeatures), [filteredFeatures]);

  // Every source-data-affecting slice of view state patches the shared canvas — never a style
  // rebuild the surface calls into (MapStage.patchData rebuilds the style internally).
  useEffect(() => {
    stage.patchData({
      featureCollection: { type: 'FeatureCollection', features: filteredFeatures },
      jurisdictionAreaFeatures: view.source.jurisdictionAreaFeatures,
      layerMode: view.viewState.layerMode,
      densityLevels: view.viewState.layerMode === 'presence' ? view.densityLevels : [],
      countyChoroplethLevels: countyChoroplethLevels,
      clusteringEnabled: view.viewState.group,
      historyEdgesEnabled: view.viewState.lines,
      historyEdgeCollection: view.edgeLineCollection,
    });
  }, [
    stage,
    filteredFeatures,
    view.source.jurisdictionAreaFeatures,
    view.viewState.layerMode,
    view.viewState.group,
    view.densityLevels,
    countyChoroplethLevels,
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
        const feature = view.allFeatures.find((item) => item.properties.entityId === viewState.selected);
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
          stage.flyPreset('state', { center: [viewport.lng, viewport.lat], zoom: viewport.zoom }, { mode });
          return;
        }
      }
      if (viewState.viewport) {
        stage.flyPreset(
          'locality',
          { center: [viewState.viewport.lng, viewState.viewport.lat], zoom: viewState.viewport.zoom },
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
  useEffect(() => {
    if (fromHeroTransition) return;
    reconcileCamera(initial.viewState, 'ease');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back/forward: the URL changes under us via `popstate`. Restore the full shareable view
  // (filters/selection/toggles) and reconcile the camera — without calling `router.replace`
  // (the address bar is already correct). Own `replace` calls never fire `popstate`.
  useEffect(() => {
    function handlePopState() {
      const raw = Object.fromEntries(new URLSearchParams(window.location.search).entries());
      const next = parseExploreSearchParams(raw);
      const edgeSlice = pickExploreEdgeSlice(view.edgeLineCatalog, next);
      const selectedEdge = next.edge ? edgeSlice.edges.find((edge) => edge.edgeId === next.edge) : undefined;
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

  const handleHideFilters = useCallback(() => {
    commitViewState(mergeViewState(view.viewState, { showFilters: false }));
  }, [commitViewState, view.viewState]);

  const handleShowFilters = useCallback(() => {
    commitViewState(mergeViewState(view.viewState, { showFilters: true }));
  }, [commitViewState, view.viewState]);

  const handleHideResults = useCallback(() => {
    commitViewState(mergeViewState(view.viewState, { showResults: false }));
  }, [commitViewState, view.viewState]);

  const handleShowResults = useCallback(() => {
    commitViewState(mergeViewState(view.viewState, { showResults: true }));
  }, [commitViewState, view.viewState]);

  const handleSelect = useCallback(
    (entityId: string) => {
      // Stash the camera *before* the point flight so close can bounce one tier up
      // (county → state → country) instead of always dumping to CONUS / state filter.
      preSelectViewportRef.current = liveViewportRef.current ?? viewStateRef.current.viewport;
      const feature = view.allFeatures.find((item) => item.properties.entityId === entityId);
      if (feature && feature.geometry.type === 'Point') {
        const [lng, lat] = feature.geometry.coordinates;
        stage.flyPreset(
          'point',
          { center: [lng, lat], zoom: CAMERA_POINT_ZOOM },
          { padding: SELECTION_CAMERA_PADDING },
        );
      }
      commitViewState(
        mergeViewState(view.viewState, { selected: entityId, clearEdge: true }),
      );
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

  const handleLayerModeChange = useCallback(
    (layerMode: ExploreLayerMode) => {
      commitViewState(
        mergeViewState(view.viewState, {
          layerMode,
          ...(layerMode === 'off' || layerMode === 'presence' ? { clearPopulationDecades: true } : {}),
        }),
      );
    },
    [commitViewState, view.viewState],
  );

  const handlePopDecadeChange = useCallback(
    (popDecade: CensusPopulationDecade) => {
      commitViewState(mergeViewState(view.viewState, { layerMode: 'blackShare', popDecade }));
    },
    [commitViewState, view.viewState],
  );

  const handlePopFromChange = useCallback(
    (popFrom: CensusPopulationDecade) => {
      commitViewState(mergeViewState(view.viewState, { layerMode: 'blackChange', popFrom }));
    },
    [commitViewState, view.viewState],
  );

  const handlePopToChange = useCallback(
    (popTo: CensusPopulationDecade) => {
      commitViewState(mergeViewState(view.viewState, { layerMode: 'blackChange', popTo }));
    },
    [commitViewState, view.viewState],
  );

  const handleGroupToggle = useCallback(() => {
    commitViewState(mergeViewState(view.viewState, { group: !view.viewState.group }));
  }, [commitViewState, view.viewState]);

  const handleLinesToggle = useCallback(() => {
    const lines = !view.viewState.lines;
    commitViewState(
      mergeViewState(view.viewState, { lines, ...(lines ? {} : { clearEdge: true, clearDecade: true }) }),
    );
  }, [commitViewState, view.viewState]);

  const handleDecadeSelect = useCallback(
    (decade: string | undefined) => {
      commitViewState(
        mergeViewState(view.viewState, { lines: true, clearEdge: true, ...(decade ? { decade } : { clearDecade: true }) }),
      );
    },
    [commitViewState, view.viewState],
  );

  const handleEdgeSelect = useCallback(
    (edgeId: string) => {
      commitViewState(mergeViewState(view.viewState, { edge: edgeId, lines: true, clearSelected: true }));
    },
    [commitViewState, view.viewState],
  );

  const handleCloseEdge = useCallback(() => {
    commitViewState(mergeViewState(view.viewState, { clearEdge: true }));
  }, [commitViewState, view.viewState]);

  // Spotlight: focus the panel card; Escape dismisses preview or connection panel.
  const spotlightOpen = Boolean(view.selectedEdge) || Boolean(selectedFeature);
  const dismissSpotlight = view.selectedEdge ? handleCloseEdge : handleClearSelected;
  useEffect(() => {
    if (!spotlightOpen) return undefined;

    const frame = window.requestAnimationFrame(() => {
      spotlightRef.current?.querySelector<HTMLElement>('article, [tabindex]')?.focus();
    });
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      dismissSpotlight();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [spotlightOpen, dismissSpotlight]);

  const handleViewportChange = useCallback(
    (viewport: ExploreViewport) => {
      liveViewportRef.current = viewport;
      // While a record is open the camera sits at point zoom — do not overwrite the
      // pre-select stash with that framing, or close would always think we were "beyond county"
      // from the selection flight itself.
      if (!viewStateRef.current.selected) {
        preSelectViewportRef.current = viewport;
      }
      // The stage replays its latched viewport to every new subscriber, and this component
      // resubscribes whenever its handlers' view state changes — so an unchanged viewport MUST
      // be a no-op here. Without this guard the replay itself triggers `router.replace`, whose
      // RSC re-render recreates the handlers, which resubscribes, which replays: an infinite
      // one-per-second replace loop. Compare at URL precision (buildExploreHref's toFixed).
      const current = viewStateRef.current.viewport;
      if (
        current &&
        current.lat.toFixed(4) === viewport.lat.toFixed(4) &&
        current.lng.toFixed(4) === viewport.lng.toFixed(4) &&
        current.zoom.toFixed(2) === viewport.zoom.toFixed(2)
      ) {
        return;
      }
      if (viewportTimerRef.current) {
        clearTimeout(viewportTimerRef.current);
      }
      viewportTimerRef.current = setTimeout(() => {
        // Build `next` from the ref mirror, not inside the setView updater: updaters must stay
        // pure (React replays them during render), and `pushViewState` calls `router.replace` —
        // a Router state update that must never run mid-render.
        const next = mergeViewState(viewStateRef.current, { viewport });
        setView((current) => ({ ...current, viewState: next }));
        pushViewState(next);
      }, 400);
    },
    [pushViewState],
  );

  useEffect(
    () => () => {
      if (viewportTimerRef.current) {
        clearTimeout(viewportTimerRef.current);
      }
    },
    [],
  );

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
  const selectedStateName = view.viewState.state ? findUsStateByPostalCode(view.viewState.state)?.name : undefined;
  const filtersVisible = view.viewState.showFilters;
  const resultsVisible = view.viewState.showResults;
  const resultsDimmed = Boolean(view.selectedEdge || selectedFeature);

  const listProps = {
    features: sortedListFeatures,
    labelledBy: 'explore-results-heading',
    onSelect: handleSelect,
    ...(view.viewState.selected ? { selectedId: view.viewState.selected } : {}),
  };

  return (
    /* Instruments follow the site theme (light/dark) — map plate syncs via MapStage. */
    <div
      className={
        entering
          ? 'ds-explore-stage ds-explore-stage--entering'
          : 'ds-explore-stage'
      }
      data-map-journey={entering ? 'entering' : 'explore'}
    >
      {!stage.mapAvailable && degradedCopy ? (
        <div className="ds-explore-stage__notice">
          <Notice tone="warning" title="Map unavailable">
            {degradedCopy}
          </Notice>
        </div>
      ) : null}

      <div
        className={exploreFiltersPanelClassName({ visible: filtersVisible })}
        ref={filterRegionRef}
        tabIndex={filtersVisible ? -1 : undefined}
        aria-label="Map filters"
        {...(filtersVisible ? {} : { hidden: true })}
      >
        <div className="ds-explore-stage__panel-header">
          <p className="ds-explore-stage__panel-title" id="explore-facets-heading">
            Filters
          </p>
          <button
            type="button"
            className="ds-button ds-button--secondary ds-button--compact ds-explore-stage__panel-hide"
            aria-label="Hide filters"
            onClick={handleHideFilters}
          >
            Hide filters
          </button>
        </div>
        <div className="ds-explore__facets" role="group" aria-labelledby="explore-facets-heading">
          {FACET_ROWS.map(({ key, label }) => (
            <label className="ds-pill-select ds-explore__facet" key={key} htmlFor={`explore-${key}`}>
              <span className="ds-pill-select__label">{label}</span>
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
        </div>

        <div className="ds-explore-stage__toolbar">
          <LayerModelControl
            layerMode={view.viewState.layerMode}
            {...(view.viewState.popDecade ? { popDecade: view.viewState.popDecade } : {})}
            {...(view.viewState.popFrom ? { popFrom: view.viewState.popFrom } : {})}
            {...(view.viewState.popTo ? { popTo: view.viewState.popTo } : {})}
            onLayerModeChange={handleLayerModeChange}
            onPopDecadeChange={handlePopDecadeChange}
            onPopFromChange={handlePopFromChange}
            onPopToChange={handlePopToChange}
          />
          {isPopulationLayerMode(view.viewState.layerMode) && populationIndexLoaded && !populationIndex ? (
            <p className="ds-sans ds-explore__settings-note">
              County population data is not loaded yet — choropleth tiers stay neutral until the
              static index is available.
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
                <Link href="/history">Open the full history graph</Link> for the decade narrative panel.
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

      {!filtersVisible ? (
        <button
          type="button"
          className="ds-button ds-button--secondary ds-explore-stage__panel-restore ds-explore-stage__panel-restore--filters"
          aria-label="Show filters"
          onClick={handleShowFilters}
        >
          Show filters
        </button>
      ) : null}

      <div
        className={exploreResultsPanelClassName({ visible: resultsVisible, dimmed: resultsDimmed })}
        {...(resultsVisible ? {} : { hidden: true })}
      >
        <div className="ds-explore-stage__panel-header">
          {/* The count labels the list it sits above — oldest records first. */}
          <p className="ds-sans ds-explore__results-count" id="explore-results-heading">
            {filteredFeatures.length} documented record{filteredFeatures.length === 1 ? '' : 's'}
            {selectedStateName ? ` in ${selectedStateName}` : ' in view'}
            {view.viewState.lines
              ? ` · ${view.edgeLineCollection.features.length} connection${
                  view.edgeLineCollection.features.length === 1 ? '' : 's'
                }`
              : ''}
            {' · oldest first'}
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

      {!resultsVisible ? (
        <button
          type="button"
          className="ds-button ds-button--secondary ds-explore-stage__panel-restore ds-explore-stage__panel-restore--results"
          aria-label="Show records"
          onClick={handleShowResults}
        >
          Show records
        </button>
      ) : null}

      {spotlightOpen ? (
        <div className="ds-explore-stage__spotlight" ref={spotlightRef}>
          <button
            type="button"
            className="ds-explore-stage__spotlight-scrim"
            aria-label={view.selectedEdge ? 'Dismiss connection panel' : 'Dismiss record preview'}
            onClick={dismissSpotlight}
          />
          <div
            className="ds-explore-stage__spotlight-panel"
            role="dialog"
            aria-modal="true"
            aria-label={view.selectedEdge ? 'Selected connection' : 'Selected record'}
          >
            {view.selectedEdge ? (
              <HistoryEdgePanel edge={view.selectedEdge} onClose={handleCloseEdge} />
            ) : selectedFeature ? (
              <NarrativeCard feature={selectedFeature} onClose={handleClearSelected} />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="ds-explore-stage__legend">
        <MapExperienceLegend layerMode={view.viewState.layerMode} />
      </div>
    </div>
  );
}
