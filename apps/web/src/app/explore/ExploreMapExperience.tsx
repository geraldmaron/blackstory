'use client';

/**
 * Client orchestrator for `/explore` national map experience. Wires the MapLibre canvas,
 * synchronized accessible list, narrative card, density toggle, relationship lines, decade
 * settings, filter form, and shareable URL state. The server-rendered snapshot catalog is the
 * source of truth; `/explore/api` refine is optional progressive enhancement when App Check is
 * configured.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilterBar, Notice } from '@repo/ui';
import { US_CONUS_BOUNDS, findUsStateByPostalCode } from '@repo/domain/map/geography';
import { HistoryEdgePanel } from '../../components/history/HistoryEdgePanel';
import { DensityLayerToggle } from '../../components/map-experience/DensityLayerToggle';
import { MapExperienceLegend } from '../../components/map-experience/MapExperienceLegend';
import { NarrativeCard } from '../../components/map-experience/NarrativeCard';
import { SynchronizedResultList } from '../../components/map-experience/SynchronizedResultList';
import { DEGRADED_MODE_COPY } from '../../lib/map-experience/snapshot-mode';
import {
  buildExploreHref,
  type ExploreViewState,
  type ExploreViewport,
} from '../../lib/map-experience/url-state';
import { applyExploreFilters } from '../../lib/map-experience/filters';
import { buildExploreMapStyle } from '../map/explore-style';
import { ExploreMapCanvas } from '../map/ExploreMapCanvas';
import { pickExploreEdgeSlice } from './explore-edge-catalog';
import type { ExploreViewModel } from './explore-view-model';

export type ExploreMapExperienceProps = {
  readonly initial: ExploreViewModel;
};

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

function viewportForState(postalCode: string): ExploreViewport | undefined {
  const state = findUsStateByPostalCode(postalCode);
  if (!state) return undefined;
  const [west, south, east, north] = state.bbox;
  return {
    lng: (west + east) / 2,
    lat: (south + north) / 2,
    zoom: postalCode === 'AK' || postalCode === 'HI' ? 4.5 : 6.2,
  };
}

function facetFields(view: ExploreViewModel) {
  const { facetOptions, viewState } = view;
  return [
    {
      id: 'explore-kind',
      name: 'kind',
      label: 'Kind',
      type: 'select' as const,
      defaultValue: viewState.filters.kind,
      options: facetOptions.kind,
    },
    {
      id: 'explore-era',
      name: 'era',
      label: 'Era',
      type: 'select' as const,
      defaultValue: viewState.filters.era,
      options: facetOptions.era,
    },
    {
      id: 'explore-theme',
      name: 'theme',
      label: 'Theme',
      type: 'select' as const,
      defaultValue: viewState.filters.theme,
      options: facetOptions.theme,
    },
    {
      id: 'explore-confidence',
      name: 'confidence',
      label: 'Confidence',
      type: 'select' as const,
      defaultValue: viewState.filters.confidence,
      options: facetOptions.confidence,
    },
  ];
}

export function ExploreMapExperience({ initial }: ExploreMapExperienceProps) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [mapAvailable, setMapAvailable] = useState(true);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setView(initial);
  }, [initial]);

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

  const selectedFeature = useMemo(
    () =>
      view.viewState.selected
        ? filteredFeatures.find(
            (feature) => feature.properties.entityId === view.viewState.selected,
          )
        : undefined,
    [filteredFeatures, view.viewState.selected],
  );

  const mapStyle = useMemo(
    () =>
      buildExploreMapStyle({
        featureCollection: { type: 'FeatureCollection', features: filteredFeatures },
        jurisdictionAreaFeatures: view.source.jurisdictionAreaFeatures,
        densityLayerEnabled: view.viewState.density,
        historyEdgesEnabled: view.viewState.lines,
      }),
    [
      filteredFeatures,
      view.source.jurisdictionAreaFeatures,
      view.viewState.density,
      view.viewState.lines,
    ],
  );

  const applyViewState = useCallback(
    (next: ExploreViewState) => {
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

  const handleSelect = useCallback(
    (entityId: string) => {
      applyViewState(mergeViewState(view.viewState, { selected: entityId, clearEdge: true }));
    },
    [applyViewState, view.viewState],
  );

  const handleStateSelect = useCallback(
    (postalCode: string) => {
      const viewport = viewportForState(postalCode);
      applyViewState(
        mergeViewState(view.viewState, {
          state: postalCode,
          clearSelected: true,
          clearEdge: true,
          ...(viewport ? { viewport } : {}),
        }),
      );
    },
    [applyViewState, view.viewState],
  );

  const handleClearState = useCallback(() => {
    applyViewState(mergeViewState(view.viewState, { clearState: true }));
  }, [applyViewState, view.viewState]);

  const handleCloseCard = useCallback(() => {
    applyViewState(mergeViewState(view.viewState, { clearSelected: true }));
  }, [applyViewState, view.viewState]);

  const handleDensityToggle = useCallback(() => {
    applyViewState(mergeViewState(view.viewState, { density: !view.viewState.density }));
  }, [applyViewState, view.viewState]);

  const handleLinesToggle = useCallback(() => {
    const lines = !view.viewState.lines;
    applyViewState(
      mergeViewState(view.viewState, {
        lines,
        ...(lines ? {} : { clearEdge: true, clearDecade: true }),
      }),
    );
  }, [applyViewState, view.viewState]);

  const handleDecadeSelect = useCallback(
    (decade: string | undefined) => {
      applyViewState(
        mergeViewState(view.viewState, {
          lines: true,
          clearEdge: true,
          ...(decade ? { decade } : { clearDecade: true }),
        }),
      );
    },
    [applyViewState, view.viewState],
  );

  const handleEdgeSelect = useCallback(
    (edgeId: string) => {
      applyViewState(mergeViewState(view.viewState, { edge: edgeId, lines: true, clearSelected: true }));
    },
    [applyViewState, view.viewState],
  );

  const handleCloseEdge = useCallback(() => {
    applyViewState(mergeViewState(view.viewState, { clearEdge: true }));
  }, [applyViewState, view.viewState]);

  const handleViewportChange = useCallback(
    (viewport: ExploreViewport) => {
      if (viewportTimerRef.current) {
        clearTimeout(viewportTimerRef.current);
      }
      viewportTimerRef.current = setTimeout(() => {
        setView((current) => {
          const next = mergeViewState(current.viewState, { viewport });
          pushViewState(next);
          return { ...current, viewState: next };
        });
      }, 400);
    },
    [pushViewState],
  );

  const handleMapError = useCallback(() => {
    setMapAvailable(false);
  }, []);

  useEffect(
    () => () => {
      if (viewportTimerRef.current) {
        clearTimeout(viewportTimerRef.current);
      }
    },
    [],
  );

  const degradedCopy = mapAvailable ? null : DEGRADED_MODE_COPY.map_canvas_unavailable;
  const selectedStateName = view.viewState.state
    ? findUsStateByPostalCode(view.viewState.state)?.name
    : undefined;

  const canvasProps = {
    style: mapStyle,
    featureCollection: { type: 'FeatureCollection' as const, features: filteredFeatures },
    bounds: US_CONUS_BOUNDS,
    densityEnabled: view.viewState.density,
    densityLevels: view.densityLevels,
    historyEdgesEnabled: view.viewState.lines,
    historyEdgeCollection: view.edgeLineCollection,
    onSelect: handleSelect,
    onStateSelect: handleStateSelect,
    onEdgeSelect: handleEdgeSelect,
    onViewportChange: handleViewportChange,
    onMapError: handleMapError,
    ...(view.viewState.viewport ? { initialViewport: view.viewState.viewport } : {}),
    ...(view.viewState.state ? { selectedState: view.viewState.state } : {}),
    ...(view.viewState.edge ? { selectedEdge: view.viewState.edge } : {}),
  };

  const listProps = {
    features: filteredFeatures,
    labelledBy: 'explore-results-heading',
    ...(view.viewState.selected ? { selectedId: view.viewState.selected } : {}),
    ...(mapAvailable ? { onSelect: handleSelect } : {}),
  };

  return (
    <div className="bb-explore">
      {!mapAvailable && degradedCopy ? (
        <Notice tone="warning" title="Map unavailable">
          {degradedCopy}
        </Notice>
      ) : null}

      <FilterBar
        method="get"
        action="/explore"
        legend="Filter documented records"
        fields={facetFields(view)}
        actions={
          <>
            {view.viewState.density ? <input type="hidden" name="density" value="1" /> : null}
            {view.viewState.lines ? <input type="hidden" name="lines" value="1" /> : null}
            {view.viewState.decade ? (
              <input type="hidden" name="decade" value={view.viewState.decade} />
            ) : null}
            {view.viewState.edge ? (
              <input type="hidden" name="edge" value={view.viewState.edge} />
            ) : null}
            {view.viewState.state ? (
              <input type="hidden" name="state" value={view.viewState.state} />
            ) : null}
            {view.viewState.viewport ? (
              <>
                <input type="hidden" name="lat" value={view.viewState.viewport.lat.toFixed(4)} />
                <input type="hidden" name="lng" value={view.viewState.viewport.lng.toFixed(4)} />
                <input
                  type="hidden"
                  name="zoom"
                  value={view.viewState.viewport.zoom.toFixed(2)}
                />
              </>
            ) : null}
            {view.viewState.selected ? (
              <input type="hidden" name="selected" value={view.viewState.selected} />
            ) : null}
            <button type="submit" className="bb-button bb-button--primary">
              Apply filters
            </button>
          </>
        }
      />

      <div className="bb-explore__toolbar">
        <DensityLayerToggle enabled={view.viewState.density} onToggle={handleDensityToggle} />
        <details className="bb-explore__settings" open={view.viewState.lines}>
          <summary>Map settings</summary>
          <div className="bb-explore__settings-body">
            <fieldset className="bb-explore__settings-fieldset">
              <legend className="bb-sans">Relationship lines</legend>
              <button
                type="button"
                className="bb-button"
                aria-pressed={view.viewState.lines}
                onClick={handleLinesToggle}
              >
                Lines: {view.viewState.lines ? 'on' : 'off'}
              </button>
              <p className="bb-sans bb-explore__settings-note">
                Evidence-backed History connections only. Campus-shared endpoints show a short
                display stub.
              </p>
            </fieldset>

            {view.viewState.lines ? (
              <fieldset className="bb-explore__settings-fieldset">
                <legend className="bb-sans">Decade</legend>
                <div className="bb-explore__decade-row" role="tablist" aria-label="Line decade">
                  <button
                    type="button"
                    role="tab"
                    className="bb-button"
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
                      className="bb-button"
                      aria-selected={view.viewState.decade === decade}
                      onClick={() => handleDecadeSelect(decade)}
                    >
                      {decade}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <p className="bb-sans">
              <a href="/history">Open the full history graph</a> for the decade narrative panel.
            </p>
          </div>
        </details>
        <p className="bb-sans bb-explore__results-count" id="explore-results-heading">
          {filteredFeatures.length} documented record{filteredFeatures.length === 1 ? '' : 's'}
          {selectedStateName ? ` in ${selectedStateName}` : ' in view'}
          {view.viewState.lines
            ? ` · ${view.edgeLineCollection.features.length} connection${
                view.edgeLineCollection.features.length === 1 ? '' : 's'
              }`
            : ''}
        </p>
        {view.viewState.state ? (
          <button type="button" className="bb-button" onClick={handleClearState}>
            Clear state
          </button>
        ) : null}
      </div>

      <div className="bb-explore__layout">
        {mapAvailable ? (
          <div className="bb-explore__map-panel">
            <ExploreMapCanvas {...canvasProps} />
          </div>
        ) : null}

        <div className="bb-explore__list-panel">
          {view.selectedEdge ? (
            <div className="bb-explore__narrative">
              <HistoryEdgePanel edge={view.selectedEdge} onClose={handleCloseEdge} />
            </div>
          ) : null}
          {selectedFeature ? (
            <div className="bb-explore__narrative">
              <NarrativeCard feature={selectedFeature} onClose={handleCloseCard} />
            </div>
          ) : null}
          <SynchronizedResultList {...listProps} />
        </div>
      </div>

      <MapExperienceLegend />
    </div>
  );
}
