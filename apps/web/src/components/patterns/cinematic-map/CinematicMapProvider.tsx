'use client';

/**
 * Reusable context + hook for the Cinematic Map Backdrop pattern
 * (`docs/ui/patterns-cinematic-map.md` §2 contract, §6 module table). Pure state + wiring only —
 * no scrim, no controls, no CSS (that is `repo-4v3a.3`'s job). The state machine itself lives in
 * `cinematic-map-state.ts` and is unit-tested there without React or `maplibre-gl`.
 *
 * The camera/selection driver is injected via the `driver` prop rather than importing
 * `useMapStage()` directly, so:
 *  - this module stays mountable (and testable) without a `MapStageProvider` ancestor;
 *  - `select`/`deselect` are guaranteed to only ever reach the single-feature path
 *    (`MapStage.tsx`'s `setSelectedEntityFilter`, backed by `explore-style.ts`'s
 *    `selectedPointFilterExpression` — see `repo-4v3a.1`), never a whole-source re-filter,
 *    because the driver contract has no "filter all pins" shape to fall back to.
 * A route wires the real driver with `useMapStage()` (`flyPreset` + `applyViewState`) once it
 * adopts this pattern (`repo-4v3a.4` / `repo-4v3a.5`).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type { CameraPresetName } from '../../../lib/map-experience/camera-presets';

void React;
import {
  CINEMATIC_MAP_INITIAL_STATE,
  cinematicMapReducer,
  type CinematicMapState,
} from './cinematic-map-state';

/**
 * The camera/selection side-effects a route must supply. Selecting/deselecting must resolve to
 * a single-feature paint update (spec §2 rule 5) — routes wire this to `MapStage`'s
 * `applyViewState({ selectedEntity })`, not a raw `setFilter` on the whole entities layer.
 */
export type CinematicMapDriver = {
  readonly select: (entityId: string) => void;
  readonly deselect: () => void;
  /** Reuses the route's authored camera preset — never invent new easing/timing here (spec §3). */
  readonly flyTo: (preset: CameraPresetName) => void;
};

/** No-op driver so the provider can mount (and be unit-tested) with no `MapStage` present yet. */
const NOOP_DRIVER: CinematicMapDriver = {
  select: () => {},
  deselect: () => {},
  flyTo: () => {},
};

export type UseCinematicMapResult = {
  readonly state: CinematicMapState;
  readonly selectedEntityId: string | undefined;
  /** Rest -> Invite (spec §1 Invite row). No-op once past Rest — safe to call repeatedly from
   * a `MapIntroBeat`'s IntersectionObserver callback. */
  readonly invite: () => void;
  readonly engage: () => void;
  readonly close: () => void;
  readonly select: (entityId: string) => void;
  readonly deselect: () => void;
  readonly flyTo: (preset: CameraPresetName) => void;
};

const CinematicMapContext = createContext<UseCinematicMapResult | undefined>(undefined);

export type CinematicMapProviderProps = {
  readonly children: ReactNode;
  /** Camera/selection side effects. Defaults to a no-op driver (state-only mount). */
  readonly driver?: CinematicMapDriver;
  /** The surface's resting camera preset — `close()` flies back here (spec §2 rule 4). */
  readonly homePreset: CameraPresetName;
};

export function CinematicMapProvider(props: CinematicMapProviderProps) {
  const { children, homePreset } = props;
  const driver = props.driver ?? NOOP_DRIVER;
  const [reducerState, dispatch] = useReducer(cinematicMapReducer, CINEMATIC_MAP_INITIAL_STATE);

  const invite = useCallback(() => dispatch({ type: 'invite' }), []);

  const engage = useCallback(() => dispatch({ type: 'engage' }), []);

  const close = useCallback(() => {
    dispatch({ type: 'close' });
    driver.deselect();
    driver.flyTo(homePreset);
  }, [driver, homePreset]);

  const select = useCallback(
    (entityId: string) => {
      dispatch({ type: 'select', entityId });
      driver.select(entityId);
    },
    [driver],
  );

  const deselect = useCallback(() => {
    dispatch({ type: 'deselect' });
    driver.deselect();
  }, [driver]);

  const flyTo = useCallback((preset: CameraPresetName) => driver.flyTo(preset), [driver]);

  const value = useMemo<UseCinematicMapResult>(
    () => ({
      state: reducerState.state,
      selectedEntityId: reducerState.selectedEntityId,
      invite,
      engage,
      close,
      select,
      deselect,
      flyTo,
    }),
    [reducerState, invite, engage, close, select, deselect, flyTo],
  );

  return <CinematicMapContext.Provider value={value}>{children}</CinematicMapContext.Provider>;
}

export function useCinematicMap(): UseCinematicMapResult {
  const value = useContext(CinematicMapContext);
  if (!value) {
    throw new Error('useCinematicMap() must be called inside a <CinematicMapProvider>.');
  }
  return value;
}
