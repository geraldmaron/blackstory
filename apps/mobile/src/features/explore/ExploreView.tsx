/**
 * The flagship Explore experience (MOB-012): full-bleed native map + v6 floating
 * instruments + records rail bottom sheet and entity preview on pin selection,
 * composed on top of MOB-011's `MapScreen`.
 *
 * This component is deliberately ROUTER-FREE and side-effect-light: the Expo
 * Router route (`app/(tabs)/explore.tsx`) reads/validates params and supplies
 * `filters`, `selectedParam`, and the navigation callbacks, so the whole Explore
 * experience is unit-testable with RNTL without mounting the router. All shared
 * map/sheet state flows through `exploreReducer` (see explore-controller.ts for
 * the no-focus-theft architecture); this component only wires views to it.
 *
 * Failure posture (ADR-024 §7 / bead requirement): when the map is in an error
 * state, `MapScreen` renders the degraded `ErrorState` and the records rail
 * remains fully mounted and interactive — a failed map never strands the reader.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useEditionTabBarInset } from '@/shell/edition-chrome';
import { ApiStatusBanner, ScreenCanvas } from '@/ui';
import {
  MapAttribution,
  MapScreen,
  type MapFeatureCollection,
  type MapLoadState,
} from '@/features/map';
import { DEMO_MAP_SOURCE } from '@/features/map';
import { EntityPreviewSheet } from '@/features/map/explore';
import {
  ExploreBottomSheet,
  EXPLORE_SHEET_FULL,
  EXPLORE_SHEET_HALF,
  EXPLORE_SHEET_PEEK,
} from '@/features/map/explore/ExploreBottomSheet';
import { ExploreFloatingChrome } from '@/features/map/explore/ExploreFloatingChrome';
import { ExploreInstrumentsPanel } from '@/features/map/explore/ExploreInstrumentsPanel';
import { ExploreRecordsRail } from '@/features/map/explore/ExploreRecordsRail';
import { attributionBottomAbovePeekSheet } from '@/features/map/explore/explore-sheet-layout';
import type { FilterState } from '@/lib/route-params';
import {
  exploreReducer,
  initialExploreState,
  visibleFeatures,
} from './explore-controller';
import { toExploreFeatures } from './explore-feature';
import { parseRestoredSelection } from './selection';
import { useReduceMotion } from './useReduceMotion';

export type ExploreViewProps = {
  /** Redacted, release-coupled source. Defaults to the demo source (ADR-024). */
  readonly source?: MapFeatureCollection;
  /** Validated filter state from the route query params. */
  readonly filters?: FilterState;
  /** Raw `selected` query param, validated + reconciled for restoration. */
  readonly selectedParam?: unknown;
  /** Injected map load/failure state; defaults to ready. */
  readonly loadState?: MapLoadState;
  /** True when bundled demo fixtures back the map (`__DEV__` fallback only). */
  readonly usingDemo?: boolean;
  /** Retry callback for map-data / basemap failure states. */
  readonly onRetryMap?: () => void;
  /** Reduced-motion override (defaults to the OS setting). */
  readonly reduceMotion?: boolean;
  /** Navigate to the full entity route (MOB-014 owns its content). */
  readonly onOpenEntity: (entityId: string) => void;
  /** Optional — open filter modal (legacy fallback). */
  readonly onOpenFilters?: () => void;
  /** Optional — open color key modal (legacy fallback). */
  readonly onOpenColorKey?: () => void;
  /** Optional — Agent C wires Search tab / route. */
  readonly onOpenSearch?: () => void;
  /** Notify the route when filter state should sync to the URL. */
  readonly onFiltersChange?: (filters: FilterState) => void;
  /** Optional — notify the route when selection should sync to `selected`. */
  readonly onSelectionChange?: (entityId: string | null) => void;
};

export function ExploreView({
  source = DEMO_MAP_SOURCE,
  filters = {},
  selectedParam,
  loadState = { kind: 'ready' },
  usingDemo = false,
  onRetryMap,
  reduceMotion: reduceMotionProp,
  onOpenEntity,
  onOpenFilters: _onOpenFilters,
  onOpenColorKey: _onOpenColorKey,
  onOpenSearch,
  onFiltersChange,
  onSelectionChange,
}: ExploreViewProps) {
  const osReduceMotion = useReduceMotion();
  const reduceMotion = reduceMotionProp ?? osReduceMotion;
  const tabBarHeight = useEditionTabBarInset();
  const [mapAreaHeight, setMapAreaHeight] = useState(0);

  const allFeatures = useMemo(() => toExploreFeatures(source), [source]);
  const [state, dispatch] = useReducer(exploreReducer, filters, initialExploreState);
  const [instrumentsOpen, setInstrumentsOpen] = useState(false);
  const [recordsExpanded, setRecordsExpanded] = useState(false);
  const [manualSnapIndex, setManualSnapIndex] = useState(EXPLORE_SHEET_PEEK);
  const prevSelectedIdRef = useRef<string | null>(null);

  const attributionBottom = useMemo(
    () =>
      attributionBottomAbovePeekSheet({
        mapAreaHeight,
        tabBarInset: tabBarHeight,
      }),
    [mapAreaHeight, tabBarHeight],
  );

  const handleMapAreaLayout = useCallback((event: LayoutChangeEvent) => {
    setMapAreaHeight(event.nativeEvent.layout.height);
  }, []);

  useEffect(() => {
    const prevSelectedId = prevSelectedIdRef.current;
    const nextSelectedId = state.selectedId ?? null;
    prevSelectedIdRef.current = nextSelectedId;

    if (nextSelectedId && !prevSelectedId) {
      setManualSnapIndex(EXPLORE_SHEET_HALF);
      setRecordsExpanded(true);
      return;
    }
    if (!nextSelectedId && prevSelectedId) {
      setManualSnapIndex(EXPLORE_SHEET_PEEK);
      setRecordsExpanded(false);
    }
  }, [state.selectedId]);

  useEffect(() => {
    dispatch({ type: 'filtersChanged', filters });
  }, [filters]);

  useEffect(() => {
    dispatch({ type: 'availableReconciled', available: allFeatures });
  }, [allFeatures]);

  useEffect(() => {
    const restored = parseRestoredSelection(selectedParam, allFeatures);
    if (restored.selectedId) {
      const feature = allFeatures.find((f) => f.entityId === restored.selectedId);
      if (feature) {
        dispatch({ type: 'entitySelected', entityId: feature.entityId, point: feature.coordinates });
      }
    }
  }, [selectedParam, allFeatures]);

  const selectionNotifyReady = useRef(false);
  useEffect(() => {
    if (!selectionNotifyReady.current) {
      selectionNotifyReady.current = true;
      return;
    }
    onSelectionChange?.(state.selectedId ?? null);
  }, [state.selectedId, onSelectionChange]);

  const listFeatures = useMemo(() => visibleFeatures(allFeatures, state), [allFeatures, state]);
  const scopeLabel = state.viewport ? 'In view' : 'All records';
  const sheetSnapIndex = state.selectedId
    ? Math.max(manualSnapIndex, EXPLORE_SHEET_HALF)
    : recordsExpanded
      ? EXPLORE_SHEET_FULL
      : manualSnapIndex;
  const attributionVisible = sheetSnapIndex <= EXPLORE_SHEET_PEEK && !instrumentsOpen;

  const selectedFeature = state.selectedId
    ? allFeatures.find((f) => f.entityId === state.selectedId) ?? null
    : null;

  const selectedIndex = selectedFeature
    ? listFeatures.findIndex((f) => f.entityId === selectedFeature.entityId)
    : -1;

  const cameraCommand = state.cameraCommand
    ? { ...state.cameraCommand }
    : null;

  const showDemoHint =
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    (usingDemo || source === DEMO_MAP_SOURCE);

  const handleToggleInstruments = useCallback(() => {
    setInstrumentsOpen((open) => {
      const next = !open;
      if (next) {
        setRecordsExpanded(false);
        setManualSnapIndex(EXPLORE_SHEET_PEEK);
      }
      return next;
    });
  }, []);

  const handleToggleRecords = useCallback(() => {
    setRecordsExpanded((expanded) => {
      const next = !expanded;
      if (next) {
        setInstrumentsOpen(false);
      } else {
        setManualSnapIndex(EXPLORE_SHEET_PEEK);
      }
      return next;
    });
  }, []);

  const handleFiltersChange = useCallback(
    (next: FilterState) => {
      onFiltersChange?.(next);
    },
    [onFiltersChange],
  );

  const handleBrowsePrevious = useCallback(() => {
    if (selectedIndex <= 0 || listFeatures.length === 0) return;
    const prev = listFeatures[selectedIndex - 1]!;
    dispatch({ type: 'entitySelected', entityId: prev.entityId, point: prev.coordinates });
  }, [listFeatures, selectedIndex]);

  const handleBrowseNext = useCallback(() => {
    if (selectedIndex < 0 || selectedIndex >= listFeatures.length - 1) return;
    const next = listFeatures[selectedIndex + 1]!;
    dispatch({ type: 'entitySelected', entityId: next.entityId, point: next.coordinates });
  }, [listFeatures, selectedIndex]);

  return (
    <ScreenCanvas edges={['top', 'left', 'right']}>
      <ApiStatusBanner compact />

      <View
        style={styles.mapArea}
        testID="explore-map-area"
        pointerEvents="box-none"
        onLayout={handleMapAreaLayout}
      >
        <MapScreen
          source={source}
          loadState={loadState}
          onRetry={onRetryMap}
          reduceMotion={reduceMotion}
          selectedEntityId={state.selectedId}
          cameraCommand={cameraCommand}
          showAttribution={false}
          onViewportChange={(bbox) => dispatch({ type: 'viewportChanged', bbox })}
          onFeaturePress={(entityId) => {
            const feature = allFeatures.find((f) => f.entityId === entityId);
            if (feature) {
              setInstrumentsOpen(false);
              dispatch({ type: 'entitySelected', entityId, point: feature.coordinates });
            }
          }}
        />

        <MapAttribution
          bottom={attributionBottom}
          visible={attributionVisible}
          compact
        />

        <ExploreFloatingChrome
          inViewCount={listFeatures.length}
          releaseCount={allFeatures.length}
          scopeLabel={scopeLabel}
          filters={filters}
          showDemoHint={showDemoHint}
          instrumentsOpen={instrumentsOpen}
          recordsExpanded={recordsExpanded || sheetSnapIndex >= EXPLORE_SHEET_HALF}
          onToggleInstruments={handleToggleInstruments}
          onToggleRecords={handleToggleRecords}
          onOpenSearch={onOpenSearch}
          onNationalView={() => dispatch({ type: 'presetRequested', preset: 'national' })}
        />

        {instrumentsOpen ? (
          <View
            style={[styles.instrumentsOverlay, { bottom: attributionBottom }]}
            pointerEvents="box-none"
          >
            <ExploreInstrumentsPanel
              filters={filters}
              features={allFeatures}
              onFiltersChange={handleFiltersChange}
              onHide={() => setInstrumentsOpen(false)}
              onOpenPlaceFind={onOpenSearch}
            />
          </View>
        ) : null}

        <ExploreBottomSheet
          snapIndex={sheetSnapIndex}
          hasSelection={Boolean(selectedFeature)}
          reduceMotion={reduceMotion}
          bottomInset={tabBarHeight}
          scrollable={Boolean(selectedFeature)}
          sheetList={!selectedFeature}
          onSnapIndexChange={(index) => {
            setManualSnapIndex(index);
            if (index >= EXPLORE_SHEET_HALF) {
              setRecordsExpanded(true);
            }
            if (index === EXPLORE_SHEET_PEEK && !selectedFeature) {
              setRecordsExpanded(false);
            }
          }}
        >
          {selectedFeature ? (
            <EntityPreviewSheet
              feature={selectedFeature}
              onOpenEntity={onOpenEntity}
              onClose={() => dispatch({ type: 'entityDeselected' })}
              onBrowsePrevious={handleBrowsePrevious}
              onBrowseNext={handleBrowseNext}
              browsePosition={
                selectedIndex >= 0
                  ? { index: selectedIndex, total: listFeatures.length }
                  : undefined
              }
            />
          ) : (
            <ExploreRecordsRail
              features={listFeatures}
              selectedId={state.selectedId}
              scopeLabel={scopeLabel}
              releaseCount={allFeatures.length}
              filters={filters}
              onUserScroll={() => dispatch({ type: 'listScrolled' })}
              onSelect={(feature) =>
                dispatch({
                  type: 'entitySelected',
                  entityId: feature.entityId,
                  point: feature.coordinates,
                })
              }
            />
          )}
        </ExploreBottomSheet>
      </View>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  mapArea: { flex: 1, position: 'relative' },
  instrumentsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 52,
    zIndex: 4,
  },
});
