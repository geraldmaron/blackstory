'use client';

/**
 * Client orchestrator for `/explore` (BB-098). Wires the shared `MapStage` (via `useMapStage()`
 * instead of mounting its own canvas), the synchronized accessible list, density toggle,
 * relationship lines, decade settings, filter form, and shareable URL state. Pin or list
 * selection opens a centered (desktop) / bottom-sheet (mobile) narrative spotlight — not a
 * buried card in the results rail — with focus handoff and Escape to dismiss. The
 * server-rendered snapshot catalog is the source of truth; `/explore/api` refine is optional
 * progressive enhancement when App Check is configured.
 *
 * Camera: every selection that has a coherent single target flies (`stage.flyPreset`, cinematic
 * arc); clearing a selection eases back out to the next-broadest tier. Deep links and
 * back/forward reconcile the camera from the URL via `easeTo` (`reconcileCamera`, run once on
 * mount and again on every `popstate`) never a raw default flight (ADR-017).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Notice } from '@blap/ui';
import { US_CONUS_BOUNDS, findUsStateByPostalCode } from '@blap/domain/map/geography';
import { HistoryEdgePanel } from '../../../components/history/HistoryEdgePanel';
import { DensityLayerToggle } from '../../../components/map-experience/DensityLayerToggle';
import { MapExperienceLegend } from '../../../components/map-experience/MapExperienceLegend';
import { NarrativeCard } from '../../../components/map-experience/NarrativeCard';
import { SynchronizedResultList } from '../../../components/map-experience/SynchronizedResultList';
import { CAMERA_POINT_ZOOM } from '../../../lib/map-experience/camera-presets';
import { DEGRADED_MODE_COPY } from '../../../lib/map-experience/snapshot-mode';
import {
  buildExploreHref,
  parseExploreSearchParams,
  viewportForState,
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
import type { ExploreViewModel } from './explore-view-model';

export type ExploreMapExperienceProps = {
  readonly initial: ExploreViewModel;
};

const TRANSITION_FLAG = 'bp-map-transition';

/** Keeps the selected pin clear of the centered (desktop) / bottom (mobile) spotlight. */
const SELECTION_CAMERA_PADDING = { top: 72, bottom: 280, left: 48, right: 48 } as const;

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
    density: patch.density ?? base.density,
    lines: patch.lines ?? base.lines,
  };

  const withSelection = {
    ...next,
    ...resolveSelected(base, patch),
    ...resolveState(base, patch),
    ...resolveDecade(base, patch),
    ...resolveEdge(base, patch),
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
  // Mirror of the latest committed view state for the debounced viewport handler below. React
  // may replay setState updater functions during render, so an updater must stay pure — the
  // handler needs the current view state OUTSIDE an updater to build the next URL.
  const viewStateRef = useRef(initial.viewState);

  useEffect(() => {
    setView(initial);
  }, [initial]);

  useEffect(() => {
    viewStateRef.current = view.viewState;
  }, [view.viewState]);

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

  // Resolve from the full catalog so a deep-linked `?selected=` still opens even when the
  // current facet set would hide that row from the list.
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
      densityEnabled: view.viewState.density,
      densityLevels: view.densityLevels,
      historyEdgesEnabled: view.viewState.lines,
      historyEdgeCollection: view.edgeLineCollection,
    });
  }, [
    stage,
    filteredFeatures,
    view.source.jurisdictionAreaFeatures,
    view.viewState.density,
    view.densityLevels,
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
  // a cinematic arc — arriving at a URL is a restore, not a descent).
  useEffect(() => {
    reconcileCamera(initial.viewState, 'ease');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back/forward: the URL changes under us via `popstate`; reconcile the camera to match. This
  // listener is separate from `router.replace` calls this component makes itself (those never
  // fire `popstate`), so filter/density/etc. changes never spuriously refly the camera.
  useEffect(() => {
    function handlePopState() {
      const raw = Object.fromEntries(new URLSearchParams(window.location.search).entries());
      reconcileCamera(parseExploreSearchParams(raw), 'ease');
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [reconcileCamera]);

  // Chrome dissolve -> entry: if the hero flagged an in-progress transition, this mount IS its
  // landing — focus filters unless a pin was the engagement target (spotlight owns that focus).
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(TRANSITION_FLAG)) {
        window.sessionStorage.removeItem(TRANSITION_FLAG);
        if (!initial.viewState.selected) {
          filterRegionRef.current?.focus();
        }
      }
    } catch {
      // sessionStorage unavailable (private browsing) — the transition still completes, just
      // without a deterministic post-landing focus target.
    }
  }, [initial.viewState.selected]);

  const handleSelect = useCallback(
    (entityId: string) => {
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

  const handleClearState = useCallback(() => {
    stage.flyPreset('national', { bounds: US_CONUS_BOUNDS }, { mode: 'ease' });
    commitViewState(mergeViewState(view.viewState, { clearState: true }));
  }, [commitViewState, stage, view.viewState]);

  const handleCloseCard = useCallback(() => {
    if (view.viewState.state) {
      const viewport = viewportForState(view.viewState.state);
      if (viewport) {
        stage.flyPreset('state', { center: [viewport.lng, viewport.lat], zoom: viewport.zoom }, { mode: 'ease' });
      }
    } else {
      stage.flyPreset('national', { bounds: US_CONUS_BOUNDS }, { mode: 'ease' });
    }
    commitViewState(mergeViewState(view.viewState, { clearSelected: true }));
  }, [commitViewState, stage, view.viewState]);

  const handleDensityToggle = useCallback(() => {
    commitViewState(mergeViewState(view.viewState, { density: !view.viewState.density }));
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

  // Spotlight: move focus into the narrative so the record is announced; Escape dismisses
  // entity or edge spotlight.
  useEffect(() => {
    const entityOpen = Boolean(selectedFeature) && !view.selectedEdge;
    const edgeOpen = Boolean(view.selectedEdge);
    if (!entityOpen && !edgeOpen) return undefined;

    const frame = window.requestAnimationFrame(() => {
      if (entityOpen) {
        spotlightRef.current?.querySelector<HTMLElement>('.bp-nc')?.focus();
      } else {
        spotlightRef.current?.querySelector<HTMLElement>('article, [tabindex]')?.focus();
      }
    });
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (edgeOpen) {
        handleCloseEdge();
      } else {
        handleCloseCard();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedFeature, view.selectedEdge, handleCloseCard, handleCloseEdge]);

  const handleViewportChange = useCallback(
    (viewport: ExploreViewport) => {
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

  const listProps = {
    features: sortedListFeatures,
    labelledBy: 'explore-results-heading',
    ...(view.viewState.selected ? { selectedId: view.viewState.selected } : {}),
  };

  return (
    /* Instruments follow the site theme (light/dark) — map plate syncs via MapStage. */
    <div className="bp-explore-stage">
      {!stage.mapAvailable && degradedCopy ? (
        <div className="bp-explore-stage__notice">
          <Notice tone="warning" title="Map unavailable">
            {degradedCopy}
          </Notice>
        </div>
      ) : null}

      <div className="bp-explore-stage__filters" ref={filterRegionRef} tabIndex={-1} aria-label="Map filters">
        <p className="bp-explore-stage__panel-title" id="explore-facets-heading">
          Filters
        </p>
        <div className="bp-explore__facets" role="group" aria-labelledby="explore-facets-heading">
          {FACET_ROWS.map(({ key, label }) => (
            <label className="bp-pill-select bp-explore__facet" key={key} htmlFor={`explore-${key}`}>
              <span className="bp-pill-select__label">{label}</span>
              <select
                className="bp-pill-select__control"
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

        <div className="bp-explore-stage__toolbar">
          <DensityLayerToggle enabled={view.viewState.density} onToggle={handleDensityToggle} />
          <details className="bp-explore-stage__disclosure" open={view.viewState.lines}>
            <summary className="bp-explore-stage__disclosure-summary">Map settings</summary>
            <div className="bp-explore__settings-body">
              <fieldset className="bp-explore__settings-fieldset">
                <legend className="bp-sans">Relationship lines</legend>
                <button
                  type="button"
                  className="bp-button"
                  aria-pressed={view.viewState.lines}
                  onClick={handleLinesToggle}
                >
                  Lines: {view.viewState.lines ? 'on' : 'off'}
                </button>
                <p className="bp-sans bp-explore__settings-note">
                  Evidence-backed History connections only. Campus-shared endpoints show a short
                  display stub.
                </p>
              </fieldset>

              {view.viewState.lines ? (
                <fieldset className="bp-explore__settings-fieldset">
                  <legend className="bp-sans">Decade</legend>
                  <div className="bp-explore__decade-row" role="tablist" aria-label="Line decade">
                    <button
                      type="button"
                      role="tab"
                      className="bp-button"
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
                        className="bp-button"
                        aria-selected={view.viewState.decade === decade}
                        onClick={() => handleDecadeSelect(decade)}
                      >
                        {decade}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              <p className="bp-sans">
                <a href="/history">Open the full history graph</a> for the decade narrative panel.
              </p>
            </div>
          </details>
          {view.viewState.state ? (
            <button type="button" className="bp-button" onClick={handleClearState}>
              Clear state
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={
          selectedFeature || view.selectedEdge
            ? 'bp-explore-stage__results bp-explore-stage__results--dimmed'
            : 'bp-explore-stage__results'
        }
      >
        {/* The count labels the list it sits above — oldest records first. */}
        <p className="bp-sans bp-explore__results-count" id="explore-results-heading">
          {filteredFeatures.length} documented record{filteredFeatures.length === 1 ? '' : 's'}
          {selectedStateName ? ` in ${selectedStateName}` : ' in view'}
          {view.viewState.lines
            ? ` · ${view.edgeLineCollection.features.length} connection${
                view.edgeLineCollection.features.length === 1 ? '' : 's'
              }`
            : ''}
          {' · oldest first'}
        </p>
        <SynchronizedResultList {...listProps} onSelect={handleSelect} />
      </div>

      {view.selectedEdge ? (
        <div className="bp-explore-stage__spotlight" ref={spotlightRef}>
          <button
            type="button"
            className="bp-explore-stage__spotlight-scrim"
            aria-label="Dismiss connection panel"
            onClick={handleCloseEdge}
          />
          <div
            className="bp-explore-stage__spotlight-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Selected connection"
          >
            <HistoryEdgePanel edge={view.selectedEdge} onClose={handleCloseEdge} />
          </div>
        </div>
      ) : null}

      {selectedFeature && !view.selectedEdge ? (
        <div className="bp-explore-stage__spotlight" ref={spotlightRef}>
          <button
            type="button"
            className="bp-explore-stage__spotlight-scrim"
            aria-label="Dismiss selected record"
            onClick={handleCloseCard}
          />
          <div
            className="bp-explore-stage__spotlight-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bp-nc-title"
          >
            <NarrativeCard feature={selectedFeature} onClose={handleCloseCard} />
          </div>
        </div>
      ) : null}

      <div className="bp-explore-stage__legend">
        <MapExperienceLegend defaultCollapsed />
      </div>
    </div>
  );
}
