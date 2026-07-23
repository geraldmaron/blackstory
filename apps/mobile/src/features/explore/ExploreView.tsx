/**
 * The flagship Explore experience (MOB-012): native map + synchronized list +
 * filters + entity preview, composed on top of MOB-011's `MapScreen`.
 *
 * This component is deliberately ROUTER-FREE and side-effect-light: the Expo
 * Router route (`app/(tabs)/explore.tsx`) reads/validates params and supplies
 * `filters`, `selectedParam`, and the navigation callbacks, so the whole Explore
 * experience is unit-testable with RNTL without mounting the router. All shared
 * map/list state flows through `exploreReducer` (see explore-controller.ts for the
 * no-focus-theft architecture); this component only wires views to it.
 *
 * Failure posture (ADR-024 §7 / bead requirement): when the map is in an error
 * state, `MapScreen` renders the degraded `ErrorState` and the list/search remain
 * fully mounted and interactive below it — a failed map never strands the reader.
 */
import { useEffect, useMemo, useReducer } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiStatusBanner, ScreenCanvas } from '@/ui';
import { MapScreen, type MapFeatureCollection, type MapLoadState } from '@/features/map';
import { DEMO_MAP_SOURCE } from '@/features/map';
import { EntityPreviewSheet, ExploreListChrome, ExploreToolbar } from '@/features/map/explore';
import type { FilterState } from '@/app/_lib/route-params';
import {
  exploreReducer,
  initialExploreState,
  visibleFeatures,
} from './explore-controller';
import { toExploreFeatures } from './explore-feature';
import { countMatches } from './explore-filter';
import { parseRestoredSelection } from './selection';
import { ExploreList } from './ExploreList';
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
  /** Reduced-motion override (defaults to the OS setting). */
  readonly reduceMotion?: boolean;
  /** Navigate to the full entity route (MOB-014 owns its content). */
  readonly onOpenEntity: (entityId: string) => void;
  /** Open the filter sheet modal. */
  readonly onOpenFilters: () => void;
};

export function ExploreView({
  source = DEMO_MAP_SOURCE,
  filters = {},
  selectedParam,
  loadState = { kind: 'ready' },
  reduceMotion: reduceMotionProp,
  onOpenEntity,
  onOpenFilters,
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

  const listFeatures = useMemo(() => visibleFeatures(allFeatures, state), [allFeatures, state]);
  const matchCount = useMemo(() => countMatches(allFeatures, filters), [allFeatures, filters]);

  const selectedFeature = state.selectedId
    ? allFeatures.find((f) => f.entityId === state.selectedId) ?? null
    : null;

  const cameraCommand = state.cameraCommand
    ? { ...state.cameraCommand }
    : null;

  return (
    <ScreenCanvas edges={['top', 'left', 'right']}>
      <ApiStatusBanner />
      <ExploreToolbar
        matchCount={matchCount}
        filters={filters}
        showDemoHint={
          typeof __DEV__ !== 'undefined' && __DEV__ && source === DEMO_MAP_SOURCE
        }
        onOpenFilters={onOpenFilters}
        onNationalView={() => dispatch({ type: 'presetRequested', preset: 'national' })}
      />

      <View style={styles.mapArea} testID="explore-map-area">
        <MapScreen
          source={source}
          loadState={loadState}
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
        <EntityPreviewSheet
          feature={selectedFeature}
          onOpenEntity={onOpenEntity}
          onClose={() => dispatch({ type: 'entityDeselected' })}
        />
      </View>

      <ExploreListChrome testID="explore-list-area">
        <ExploreList
          features={listFeatures}
          selectedId={state.selectedId}
          onUserScroll={() => dispatch({ type: 'listScrolled' })}
          onSelect={(feature) =>
            dispatch({ type: 'entitySelected', entityId: feature.entityId, point: feature.coordinates })
          }
        />
      </ExploreListChrome>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  mapArea: { flex: 1, position: 'relative' },
});
