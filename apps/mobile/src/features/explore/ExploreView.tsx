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
 * Failure posture (`docs/decisions-carryover.md`, "Native map render layer" §7 /
 * bead requirement): when the map is in an error
 * state, `MapScreen` renders the degraded `ErrorState` and the records rail
 * remains fully mounted and interactive — a failed map never strands the reader.
 *
 * Two postures, chosen from the WINDOW and not from the device (Wave 8). On a phone-shaped
 * window the map is full-bleed and the records rail rides a bottom sheet over it. On a
 * tablet-shaped one — see `explore-pane-layout.ts` for where the line falls and why — the
 * sheet is not mounted at all and the rail becomes a persistent pane beside the map, so a
 * selection no longer costs the reader the list. Everything else is shared: same reducer,
 * same rail component, same preview component, same selection semantics. Dragging an iPad
 * split-view divider moves the app between the two live, the same way rotating does.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  ApiStatusBanner,
  ScreenCanvas,
  Z_LAYER,
  duration,
  space,
  useThemeColors,
  MIN_TOUCH_TARGET,
} from '@/ui';
import {
  MapAttribution,
  MapScreen,
  CINEMATIC_MAP_INITIAL_STATE,
  cinematicMapReducer,
  type MapFeatureCollection,
  type MapLoadState,
} from '@/features/map';
import { DEMO_MAP_SOURCE } from '@/features/map';
import { EntityPreviewSheet } from '@/features/explore';
import {
  ExploreBottomSheet,
  EXPLORE_SHEET_FULL,
  EXPLORE_SHEET_HALF,
  EXPLORE_SHEET_PEEK,
} from '@/features/explore/ExploreBottomSheet';
import { ExploreFloatingChrome } from '@/features/explore/ExploreFloatingChrome';
import { ExploreInstrumentsPanel } from '@/features/explore/ExploreInstrumentsPanel';
import { ExploreRecordsRail } from '@/features/explore/ExploreRecordsRail';
import { ExploreSideRail } from '@/features/explore/ExploreSideRail';
import { explorePaneLayout } from '@/features/explore/explore-pane-layout';
import { attributionBottomAbovePeekSheet } from '@/features/explore/explore-sheet-layout';
import { useLayoutSize } from '@/ui/layout';
import type { FilterState } from '@/lib/route-params';
import { exploreReducer, initialExploreState, visibleFeatures } from './explore-controller';
import { applyFilters, sameFilterState } from './explore-filter';
import { toExploreFeatures, toMapFeatureCollection, type ExploreFeature } from './explore-feature';
import { parseRestoredSelection } from './selection';
import { useReduceMotion } from './useReduceMotion';

/** Stable default so omitting `filters` does not re-trigger the URL sync effect. */
const EMPTY_FILTERS: FilterState = Object.freeze({});

export type ExploreViewProps = {
  /**
   * Redacted, release-coupled source (`docs/decisions-carryover.md`, "Native map
   * render layer"). This prop default is the bundled demo source; the live route
   * always passes the `GET /v1/map` payload from `useExploreMapSource`.
   */
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
  /** Navigate to a published story by slug — the preview's "Cited in" list is the only caller. */
  readonly onOpenStory?: (slug: string) => void;
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
  filters = EMPTY_FILTERS,
  selectedParam,
  loadState = { kind: 'ready' },
  usingDemo = false,
  onRetryMap,
  reduceMotion: reduceMotionProp,
  onOpenEntity,
  onOpenStory,
  onOpenFilters: _onOpenFilters,
  onOpenColorKey: _onOpenColorKey,
  onOpenSearch,
  onFiltersChange,
  onSelectionChange,
}: ExploreViewProps) {
  const osReduceMotion = useReduceMotion();
  const reduceMotion = reduceMotionProp ?? osReduceMotion;
  const theme = useThemeColors();
  const layoutSize = useLayoutSize();
  const paneLayout = explorePaneLayout(layoutSize);
  const twoPane = paneLayout.kind === 'two-pane';
  const [mapAreaHeight, setMapAreaHeight] = useState(0);

  const allFeatures = useMemo(() => toExploreFeatures(source), [source]);
  const [state, dispatch] = useReducer(exploreReducer, filters, initialExploreState);
  // Chrome posture, and nothing else. `engaged` means the reader asked for more map: the
  // floating chrome and instruments recede and a collapse control appears. It does NOT mean the
  // map became touchable — the map is touchable in every posture, because a map that ignores a
  // deliberate pan has told the reader it is broken.
  //
  // Camera and single-feature selection flow through `exploreReducer` above, whose
  // `presetRequested` / `entitySelected` actions already produce one-shot tokened
  // `cameraCommand`s via `mapCamera.ts`. This reducer is not asked to duplicate that.
  const [cinematic, cinematicDispatch] = useReducer(
    cinematicMapReducer,
    CINEMATIC_MAP_INITIAL_STATE,
  );
  const mapImmersive = cinematic.state === 'engaged';
  const [instrumentsOpen, setInstrumentsOpen] = useState(false);
  // Single controlled source of truth for the sheet snap (the gesture is
  // authoritative — see `onSnapIndexChange`). A separate `recordsExpanded`
  // boolean used to disagree with the gesture and yank the sheet back to full
  // when the user dragged it to half; that derived-vs-gesture conflict is gone.
  const [snapIndex, setSnapIndex] = useState(EXPLORE_SHEET_PEEK);
  // Peek is sized to the rail header rather than to a share of the screen (repo-pmi5n). Rounded
  // before it lands in state so a sub-pixel layout jitter cannot re-snap the sheet on every pass.
  const [peekHeaderHeight, setPeekHeaderHeight] = useState<number | undefined>(undefined);
  const handleHeaderLayout = useCallback((height: number) => {
    setPeekHeaderHeight((current) => {
      const next = Math.round(height);
      return current === next ? current : next;
    });
  }, []);
  const [chromeHeight, setChromeHeight] = useState(0);
  const prevSelectedIdRef = useRef<string | null>(null);
  /** Optimistic chip apply awaiting URL/`filters` prop catch-up. */
  const pendingFiltersRef = useRef<FilterState | null>(null);

  const attributionBottom = useMemo(
    () =>
      // Nothing covers the bottom of the map pane in the wide layout — the rail is beside it,
      // not over it — so the pill only needs to clear the pane's own edge.
      twoPane
        ? space['3']
        : attributionBottomAbovePeekSheet({
            mapAreaHeight,
            // The tab screen's content area already stops at the tab bar, so the pill clears the
            // sheet alone. Adding the tab-bar height here counted it twice, the same double count
            // that lifted the sheet a whole tab bar off the bottom (repo-pmi5n).
            tabBarInset: 0,
            ...(peekHeaderHeight === undefined ? {} : { peekHeaderHeight }),
          }),
    [twoPane, mapAreaHeight, peekHeaderHeight],
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
    // Route params can lag one frame behind an optimistic chip apply. Do not
    // clobber live local filters with a stale empty/previous props object.
    const pending = pendingFiltersRef.current;
    if (pending) {
      if (sameFilterState(filters, pending)) {
        pendingFiltersRef.current = null;
      } else {
        return;
      }
    }
    dispatch({ type: 'filtersChanged', filters });
  }, [filters]);

  useEffect(() => {
    dispatch({ type: 'availableReconciled', available: allFeatures });
  }, [allFeatures]);

  useEffect(() => {
    const restored = parseRestoredSelection(selectedParam, allFeatures);
    if (!restored.selectedId) return;
    // Restoration only, never an echo. The route writes every selection back into `?selected=`,
    // so this effect re-runs a frame after each tap with the id the reader just chose. Acting on
    // that echo re-dispatched `entitySelected` and fired a second camera command — which is how a
    // rail tap kept flying to the ceiling zoom on a tablet even after the tap itself stopped
    // asking it to (and why the phone issued two camera commands per tap, one of them redundant).
    // A selection already in state has nothing to restore.
    if (restored.selectedId === state.selectedId) return;
    const feature = allFeatures.find((f) => f.entityId === restored.selectedId);
    if (!feature) return;
    dispatch({
      type: 'entitySelected',
      entityId: feature.entityId,
      point: feature.coordinates,
    });
    // `state.selectedId` is read as a guard, not as an input: adding it to the dependency list
    // would re-run this on every selection change, which is the loop being closed off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParam, allFeatures]);

  const selectionNotifyReady = useRef(false);
  useEffect(() => {
    if (!selectionNotifyReady.current) {
      selectionNotifyReady.current = true;
      return;
    }
    onSelectionChange?.(state.selectedId ?? null);
  }, [state.selectedId, onSelectionChange]);

  // Catalog = filter facets only (web parity). List further intersects viewport.
  // Map pins use the catalog so selected chips hide non-matching pins immediately.
  const catalogFeatures = useMemo(
    () => applyFilters(allFeatures, state.filters),
    [allFeatures, state.filters],
  );
  const listFeatures = useMemo(() => visibleFeatures(allFeatures, state), [allFeatures, state]);
  const filteredMapSource = useMemo(
    () => toMapFeatureCollection(catalogFeatures),
    [catalogFeatures],
  );

  // Drop selection when the active filters hide the selected pin (selected = visible).
  useEffect(() => {
    if (!state.selectedId) return;
    if (catalogFeatures.some((feature) => feature.entityId === state.selectedId)) return;
    dispatch({ type: 'entityDeselected' });
  }, [catalogFeatures, state.selectedId]);

  const scopeLabel = state.viewport ? 'Nearby' : 'All pinned';
  // A selection floors the sheet at half; otherwise the gesture-controlled
  // `snapIndex` IS the sheet position. There is no separate boolean that can
  // recompute a different index and fight the drag.
  const sheetSnapIndex = state.selectedId ? Math.max(snapIndex, EXPLORE_SHEET_HALF) : snapIndex;
  const recordsExpanded = sheetSnapIndex >= EXPLORE_SHEET_HALF;
  // Attribution and floating chrome are meaningless without a live basemap and
  // must not overlay MapScreen's error/loading state (the pill lands on the
  // retry button). Gate both on the map being live; the sheet always stays.
  const mapLive = loadState.kind === 'ready';
  const attributionVisible =
    mapLive && (twoPane || sheetSnapIndex <= EXPLORE_SHEET_PEEK) && !instrumentsOpen;
  const instrumentsTop = space['1'] + chromeHeight + space['2'];

  const selectedFeature = state.selectedId
    ? (allFeatures.find((f) => f.entityId === state.selectedId) ?? null)
    : null;

  const selectedIndex = selectedFeature
    ? listFeatures.findIndex((f) => f.entityId === selectedFeature.entityId)
    : -1;

  const cameraCommand = state.cameraCommand ? { ...state.cameraCommand } : null;

  const showDemoHint =
    typeof __DEV__ !== 'undefined' && __DEV__ && (usingDemo || source === DEMO_MAP_SOURCE);

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
      // Optimistic local apply so pins / rail / mast update on the same tap as
      // the chip (selected = active). Route sync may round-trip afterward.
      pendingFiltersRef.current = onFiltersChange ? next : null;
      dispatch({ type: 'filtersChanged', filters: next });
      onFiltersChange?.(next);
    },
    [onFiltersChange],
  );

  /**
   * Selecting a record the reader can already see, versus one they asked to travel to.
   *
   * The phone flies: its list is about to be replaced by the preview anyway, so there is no
   * view to preserve and "show me where this is" is the whole point of the tap. The wide
   * layout does not, and this is the difference that makes the persistent rail worth having.
   * `point` is the ceiling zoom, so on a tablet a single tap would take the reader from a
   * national view to one street and take the list from 3,892 rows to 1 — the record they just
   * asked about, and nothing else. Keeping the camera still keeps both the reader's view and
   * the neighbours they were stepping through; the pin still takes the selected halo, and the
   * list is viewport-scoped, so what they tapped was on screen to begin with.
   *
   * Deep links are unaffected: a cold start with `?selected=` still frames the record, because
   * a reader arriving on a link has no view to preserve.
   */
  const selectFeature = useCallback(
    (feature: Pick<ExploreFeature, 'entityId' | 'coordinates'>) => {
      if (twoPane) {
        dispatch({ type: 'entitySelectedInPlace', entityId: feature.entityId });
        return;
      }
      dispatch({
        type: 'entitySelected',
        entityId: feature.entityId,
        point: feature.coordinates,
      });
    },
    [twoPane],
  );

  const handleBrowsePrevious = useCallback(() => {
    if (selectedIndex <= 0 || listFeatures.length === 0) return;
    selectFeature(listFeatures[selectedIndex - 1]!);
  }, [listFeatures, selectedIndex, selectFeature]);

  const handleBrowseNext = useCallback(() => {
    if (selectedIndex < 0 || selectedIndex >= listFeatures.length - 1) return;
    selectFeature(listFeatures[selectedIndex + 1]!);
  }, [listFeatures, selectedIndex, selectFeature]);

  // Browse -> Immersive. The control lives in the sheet header (`ExploreRecordsRail`); the
  // sheet drops to peek and the instruments close so the map takes the majority of the surface.
  const handleEnterImmersiveMap = useCallback(() => {
    cinematicDispatch({ type: 'engage' });
    setInstrumentsOpen(false);
    setSnapIndex(EXPLORE_SHEET_PEEK);
  }, []);

  // Immersive -> Browse. Restores the chrome and nothing else.
  //
  // It deliberately does not deselect the record or fly the camera back to the national preset:
  // that would make the exit destructive, costing a reader who expanded the map, panned to a
  // county and selected a school both the school and the county for pressing the one control that
  // looks like "give me the chrome back". Immersive is a posture, so leaving it returns a posture.
  const handleExitImmersiveMap = useCallback(() => {
    cinematicDispatch({ type: 'close' });
    setSnapIndex(state.selectedId ? EXPLORE_SHEET_HALF : EXPLORE_SHEET_PEEK);
  }, [state.selectedId]);

  // Built once and placed by whichever posture is active. The wide layout mounts BOTH at the
  // same time — that is the whole point of it — so neither may assume it is the only one.
  const recordsList = (
    <ExploreRecordsRail
      features={listFeatures}
      selectedId={state.selectedId}
      scopeLabel={scopeLabel}
      releaseCount={allFeatures.length}
      filters={state.filters}
      onUserScroll={() => dispatch({ type: 'listScrolled' })}
      onSelect={selectFeature}
      onExpandMap={mapLive && !mapImmersive ? handleEnterImmersiveMap : undefined}
      onHeaderLayout={handleHeaderLayout}
      listHost={twoPane ? 'plain' : 'sheet'}
    />
  );

  const recordPreview = selectedFeature ? (
    <EntityPreviewSheet
      layout={twoPane ? 'rail' : 'sheet'}
      feature={selectedFeature}
      onOpenEntity={onOpenEntity}
      {...(onOpenStory ? { onOpenStory } : {})}
      onClose={() => dispatch({ type: 'entityDeselected' })}
      onBrowsePrevious={handleBrowsePrevious}
      onBrowseNext={handleBrowseNext}
      browsePosition={
        selectedIndex >= 0 ? { index: selectedIndex, total: listFeatures.length } : undefined
      }
    />
  ) : null;

  return (
    <ScreenCanvas edges={['top', 'left', 'right']}>
      <ApiStatusBanner compact />

      <View style={styles.panes} testID="explore-panes">
        <View
          style={styles.mapArea}
          testID="explore-map-area"
          pointerEvents="box-none"
          onLayout={handleMapAreaLayout}
        >
          <MapScreen
            source={filteredMapSource}
            loadState={loadState}
            onRetry={onRetryMap}
            reduceMotion={reduceMotion}
            selectedEntityId={state.selectedId}
            cameraCommand={cameraCommand}
            showAttribution={false}
            gesturesEnabled
            onViewportChange={(bbox) => dispatch({ type: 'viewportChanged', bbox })}
            onFeaturePress={(entityId) => {
              const feature = catalogFeatures.find((f) => f.entityId === entityId);
              if (feature) {
                setInstrumentsOpen(false);
                selectFeature(feature);
              }
            }}
          />

          {mapLive && mapImmersive ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show the records list"
              accessibilityHint="Brings back the filters and the records list. Your selection and the map view are kept."
              testID="explore-map-collapse"
              onPress={handleExitImmersiveMap}
              style={({ pressed }) => [
                styles.closeControl,
                {
                  top: space['2'],
                  backgroundColor: pressed ? theme.surfacePressed : theme.surfaceRaised,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons name="close" size={20} color={theme.ink} />
            </Pressable>
          ) : null}

          <MapAttribution
            bottom={attributionBottom}
            visible={attributionVisible}
            reduceMotion={reduceMotion}
            compact
          />

          {mapLive && !mapImmersive ? (
            <ExploreFloatingChrome
              inViewCount={listFeatures.length}
              releaseCount={allFeatures.length}
              scopeLabel={scopeLabel}
              filters={state.filters}
              showDemoHint={showDemoHint}
              instrumentsOpen={instrumentsOpen}
              recordsExpanded={twoPane ? true : recordsExpanded}
              onLayout={handleChromeLayout}
              onToggleInstruments={handleToggleInstruments}
              // No records toggle in the wide layout: the rail is always up, so a control
              // that claims to raise and lower it would be lying in one of its two states.
              {...(twoPane ? {} : { onToggleRecords: handleToggleRecords })}
              onOpenSearch={onOpenSearch}
              onNationalView={() => dispatch({ type: 'presetRequested', preset: 'national' })}
            />
          ) : null}

          {mapLive && !mapImmersive && instrumentsOpen ? (
            <Animated.View
              style={[
                styles.instrumentsOverlay,
                { top: instrumentsTop, bottom: attributionBottom },
              ]}
              pointerEvents="box-none"
              entering={reduceMotion ? undefined : FadeInDown.duration(duration.durationFast)}
              exiting={reduceMotion ? undefined : FadeOutUp.duration(duration.durationFast)}
            >
              <ExploreInstrumentsPanel
                filters={state.filters}
                features={allFeatures}
                onFiltersChange={handleFiltersChange}
                onHide={() => setInstrumentsOpen(false)}
                onOpenPlaceFind={onOpenSearch}
              />
            </Animated.View>
          ) : null}

          {twoPane ? null : (
            <ExploreBottomSheet
              snapIndex={sheetSnapIndex}
              hasSelection={Boolean(selectedFeature)}
              reduceMotion={reduceMotion}
              peekHeaderHeight={peekHeaderHeight}
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
              {/* One at a time on a phone: there is no room to show a record and keep the
                  list, so the preview takes the sheet. */}
              {recordPreview ?? recordsList}
            </ExploreBottomSheet>
          )}
        </View>

        {/* Immersive hides the rail too — "expand the map" has to mean the whole window,
            or it means nothing on the device with the most window to give. */}
        {paneLayout.kind === 'two-pane' && !mapImmersive ? (
          <ExploreSideRail
            width={paneLayout.railWidth}
            {...(recordPreview ? { inspector: recordPreview } : {})}
            list={recordsList}
          />
        ) : null}
      </View>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  // Row in both postures. With one child it behaves exactly like the column it replaced, so
  // the phone layout pays nothing for the tablet one.
  panes: { flex: 1, flexDirection: 'row' },
  mapArea: { flex: 1, position: 'relative' },
  closeControl: {
    position: 'absolute',
    right: space['2'],
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: Z_LAYER.overlay,
    elevation: Z_LAYER.overlay,
  },
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
