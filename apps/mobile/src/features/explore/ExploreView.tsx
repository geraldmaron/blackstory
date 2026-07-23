/**
 * The flagship Explore experience (MOB-012): full-bleed native map + floating
 * instruments + bottom-sheet metrics dashboard (with secondary record list) and
 * entity preview on pin selection, composed on top of MOB-011's `MapScreen`.
 *
 * This component is deliberately ROUTER-FREE and side-effect-light: the Expo
 * Router route (`app/(tabs)/explore.tsx`) reads/validates params and supplies
 * `filters`, `selectedParam`, and the navigation callbacks, so the whole Explore
 * experience is unit-testable with RNTL without mounting the router. All shared
 * map/sheet state flows through `exploreReducer` (see explore-controller.ts for
 * the no-focus-theft architecture); this component only wires views to it.
 *
 * Failure posture (ADR-024 §7 / bead requirement): when the map is in an error
 * state, `MapScreen` renders the degraded `ErrorState` and the metrics sheet
 * remains fully mounted and interactive — a failed map never strands the reader.
 */
import { useEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiStatusBanner, ScreenCanvas } from '@/ui';
import { MapScreen, type MapFeatureCollection, type MapLoadState } from '@/features/map';
import { DEMO_MAP_SOURCE } from '@/features/map';
import { EntityPreviewSheet } from '@/features/map/explore';
import { ExploreBottomSheet } from '@/features/map/explore/ExploreBottomSheet';
import { ExploreFloatingChrome } from '@/features/map/explore/ExploreFloatingChrome';
import { ExploreListChrome } from '@/features/map/explore/explore-chrome';
import type { FilterState } from '@/app/_lib/route-params';
import {
  exploreReducer,
  initialExploreState,
  visibleFeatures,
} from './explore-controller';
import { toExploreFeatures } from './explore-feature';
import { countMatches } from './explore-filter';
import { ExploreMetricsDashboard } from './metrics';
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
  /** Retry callback for map-data / basemap failure states. */
  readonly onRetryMap?: () => void;
  /** Reduced-motion override (defaults to the OS setting). */
  readonly reduceMotion?: boolean;
  /** Navigate to the full entity route (MOB-014 owns its content). */
  readonly onOpenEntity: (entityId: string) => void;
  /** Open the filter sheet modal. */
  readonly onOpenFilters: () => void;
  /** Optional — Agent C wires Search tab / route. */
  readonly onOpenSearch?: () => void;
  /** Optional — notify the route when filter state should sync to the URL. */
  readonly onFiltersChange?: (filters: FilterState) => void;
  /** Optional — notify the route when selection should sync to `selected`. */
  readonly onSelectionChange?: (entityId: string | null) => void;
};

export function ExploreView({
  source = DEMO_MAP_SOURCE,
  filters = {},
  selectedParam,
  loadState = { kind: 'ready' },
  onRetryMap,
  reduceMotion: reduceMotionProp,
  onOpenEntity,
  onOpenFilters,
  onOpenSearch,
  onFiltersChange: _onFiltersChange,
  onSelectionChange,
}: ExploreViewProps) {
  const osReduceMotion = useReduceMotion();
  const reduceMotion = reduceMotionProp ?? osReduceMotion;

  const allFeatures = useMemo(() => toExploreFeatures(source), [source]);
  const [state, dispatch] = useReducer(exploreReducer, filters, initialExploreState);

  // Keep the reducer's filters in sync with the (validated) route params. Changing
  // filters is deterministic and updates the result count, but never moves the map.
  useEffect(() => {
    dispatch({ type: 'filtersChanged', filters });
  }, [filters]);

  // Reconcile the selection whenever the population changes (release swap /
  // withdrawal): a selection whose entity has disappeared is dropped gracefully.
  useEffect(() => {
    dispatch({ type: 'availableReconciled', available: allFeatures });
  }, [allFeatures]);

  // Restore a shared/deep-linked selection safely on mount (and if the param or
  // population changes): validated id + must still exist, else no selection.
  useEffect(() => {
    const restored = parseRestoredSelection(selectedParam, allFeatures);
    if (restored.selectedId) {
      const feature = allFeatures.find((f) => f.entityId === restored.selectedId);
      if (feature) {
        dispatch({ type: 'entitySelected', entityId: feature.entityId, point: feature.coordinates });
      }
    }
  }, [selectedParam, allFeatures]);

  // Mirror selection to the route when Agent C supplies a callback. Skip the
  // first paint so we do not clear a deep-linked `selected` before restore runs.
  const selectionNotifyReady = useRef(false);
  useEffect(() => {
    if (!selectionNotifyReady.current) {
      selectionNotifyReady.current = true;
      return;
    }
    onSelectionChange?.(state.selectedId ?? null);
  }, [state.selectedId, onSelectionChange]);

  const listFeatures = useMemo(() => visibleFeatures(allFeatures, state), [allFeatures, state]);
  const matchCount = useMemo(() => countMatches(allFeatures, filters), [allFeatures, filters]);
  const metricsScopeLabel = state.viewport ? 'In view' : 'All records';

  const selectedFeature = state.selectedId
    ? allFeatures.find((f) => f.entityId === state.selectedId) ?? null
    : null;

  const cameraCommand = state.cameraCommand
    ? { ...state.cameraCommand }
    : null;

  const showDemoHint =
    typeof __DEV__ !== 'undefined' && __DEV__ && source === DEMO_MAP_SOURCE;

  return (
    <ScreenCanvas edges={['top', 'left', 'right']}>
      <ApiStatusBanner />

      <View style={styles.mapArea} testID="explore-map-area">
        <MapScreen
          source={source}
          loadState={loadState}
          onRetry={onRetryMap}
          reduceMotion={reduceMotion}
          selectedEntityId={state.selectedId}
          cameraCommand={cameraCommand}
          onViewportChange={(bbox) => dispatch({ type: 'viewportChanged', bbox })}
          onFeaturePress={(entityId) => {
            const feature = allFeatures.find((f) => f.entityId === entityId);
            if (feature) {
              dispatch({ type: 'entitySelected', entityId, point: feature.coordinates });
            }
          }}
        />

        <ExploreFloatingChrome
          matchCount={matchCount}
          filters={filters}
          showDemoHint={showDemoHint}
          onOpenFilters={onOpenFilters}
          onOpenSearch={onOpenSearch}
          onNationalView={() => dispatch({ type: 'presetRequested', preset: 'national' })}
        />

        <ExploreBottomSheet hasSelection={Boolean(selectedFeature)} reduceMotion={reduceMotion}>
          {selectedFeature ? (
            <EntityPreviewSheet
              feature={selectedFeature}
              onOpenEntity={onOpenEntity}
              onClose={() => dispatch({ type: 'entityDeselected' })}
            />
          ) : (
            <ExploreListChrome testID="explore-metrics-area">
              <ExploreMetricsDashboard
                features={listFeatures}
                scopeLabel={metricsScopeLabel}
                selectedId={state.selectedId}
                reduceMotion={reduceMotion}
                onOpenSearch={onOpenSearch}
                onUserScroll={() => dispatch({ type: 'listScrolled' })}
                onSelectFeature={(feature) =>
                  dispatch({
                    type: 'entitySelected',
                    entityId: feature.entityId,
                    point: feature.coordinates,
                  })
                }
              />
            </ExploreListChrome>
          )}
        </ExploreBottomSheet>
      </View>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  mapArea: { flex: 1, position: 'relative' },
});
