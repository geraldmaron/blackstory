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
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useEditionTabBarInset } from '@/shell/edition-chrome';
import { ApiStatusBanner, ScreenCanvas, Z_LAYER, space } from '@/ui';
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
  // Single controlled source of truth for the sheet snap (the gesture is
  // authoritative — see `onSnapIndexChange`). A separate `recordsExpanded`
  // boolean used to disagree with the gesture and yank the sheet back to full
  // when the user dragged it to half; that derived-vs-gesture conflict is gone.
  const [snapIndex, setSnapIndex] = useState(EXPLORE_SHEET_PEEK);
  const [chromeHeight, setChromeHeight] = useState(0);
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

  const handleChromeLayout = useCallback((event: LayoutChangeEvent) => {
    setChromeHeight(event.nativeEvent.layout.height);
  }, []);

  useEffect(() => {
    const prevSelectedId = prevSelectedIdRef.current;
    const nextSelectedId = state.selectedId ?? null;
    prevSelectedIdRef.current = nextSelectedId;

    if (nextSelectedId && !prevSelectedId) {
      setSnapIndex(EXPLORE_SHEET_HALF);
      return;
    }
    if (!nextSelectedId && prevSelectedId) {
      setSnapIndex(EXPLORE_SHEET_PEEK);
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
  // A selection floors the sheet at half; otherwise the gesture-controlled
  // `snapIndex` IS the sheet position. There is no separate boolean that can
  // recompute a different index and fight the drag.
  const sheetSnapIndex = state.selectedId
    ? Math.max(snapIndex, EXPLORE_SHEET_HALF)
    : snapIndex;
  const recordsExpanded = sheetSnapIndex >= EXPLORE_SHEET_HALF;
  // Attribution and floating chrome are meaningless without a live basemap and
  // must not overlay MapScreen's error/loading state (the pill lands on the
  // retry button). Gate both on the map being live; the sheet always stays.
  const mapLive = loadState.kind === 'ready';
  const attributionVisible =
    mapLive && sheetSnapIndex <= EXPLORE_SHEET_PEEK && !instrumentsOpen;
  const instrumentsTop = space['1'] + chromeHeight + space['2'];

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
        setSnapIndex(EXPLORE_SHEET_PEEK);
      }
      return next;
    });
  }, []);

  const handleToggleRecords = useCallback(() => {
    if (recordsExpanded) {
      // Lower the rail. A selection floors the sheet at half, so clear it too —
      // otherwise the derived floor would immediately re-raise the sheet.
      if (state.selectedId) {
        dispatch({ type: 'entityDeselected' });
      }
      setSnapIndex(EXPLORE_SHEET_PEEK);
    } else {
      setInstrumentsOpen(false);
      setSnapIndex(EXPLORE_SHEET_FULL);
    }
  }, [recordsExpanded, state.selectedId]);

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
          reduceMotion={reduceMotion}
          compact
        />

        {mapLive ? (
          <ExploreFloatingChrome
            inViewCount={listFeatures.length}
            releaseCount={allFeatures.length}
            scopeLabel={scopeLabel}
            filters={filters}
            showDemoHint={showDemoHint}
            instrumentsOpen={instrumentsOpen}
            recordsExpanded={recordsExpanded}
            onLayout={handleChromeLayout}
            onToggleInstruments={handleToggleInstruments}
            onToggleRecords={handleToggleRecords}
            onOpenSearch={onOpenSearch}
            onNationalView={() => dispatch({ type: 'presetRequested', preset: 'national' })}
          />
        ) : null}

        {mapLive && instrumentsOpen ? (
          <Animated.View
            style={[
              styles.instrumentsOverlay,
              { top: instrumentsTop, bottom: attributionBottom },
            ]}
            pointerEvents="box-none"
            entering={reduceMotion ? undefined : FadeInDown.duration(160)}
            exiting={reduceMotion ? undefined : FadeOutUp.duration(160)}
          >
            <ExploreInstrumentsPanel
              filters={filters}
              features={allFeatures}
              onFiltersChange={handleFiltersChange}
              onHide={() => setInstrumentsOpen(false)}
              onOpenPlaceFind={onOpenSearch}
            />
          </Animated.View>
        ) : null}

        <ExploreBottomSheet
          snapIndex={sheetSnapIndex}
          hasSelection={Boolean(selectedFeature)}
          reduceMotion={reduceMotion}
          bottomInset={tabBarHeight}
          scrollable={Boolean(selectedFeature)}
          sheetList={!selectedFeature}
          onSnapIndexChange={(index) => {
            // Gesture is authoritative: the controlled index always equals where
            // the user left the sheet. If a selection is lowered below half, drop
            // the selection so the half floor releases (no snap-back yank).
            setSnapIndex(index);
            if (index < EXPLORE_SHEET_HALF && state.selectedId) {
              dispatch({ type: 'entityDeselected' });
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
    // `top` is set inline from the measured chrome height so the panel never
    // covers the mast (including the control that dismisses it). The mast sits
    // above at Z_LAYER.overlay so chrome always wins if Dynamic Type grows it.
    zIndex: Z_LAYER.mapChrome,
  },
});
