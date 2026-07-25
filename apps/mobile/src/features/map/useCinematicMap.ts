/**
 * React hook wiring for the Cinematic Map Backdrop pattern on mobile
 * (`docs/ui/patterns-cinematic-map.md` §6 — "mobile reuses `AppBottomSheet` +
 * `mapCamera.ts`; add a `useCinematicMap` equivalent"). The state machine
 * itself is `cinematic-map-state.ts` (pure, unit-tested without React or
 * MapLibre); this hook only adds the RN-idiomatic wiring on top:
 *  - `useReducer` over that pure reducer (no Context — unlike web's
 *    `CinematicMapProvider`, mobile screens instantiate this hook directly and
 *    pass its fields straight into `MapScreen`/`ExploreBottomSheet` props, the
 *    same shape `ExploreView`'s `exploreReducer` already uses for its own
 *    camera command).
 *  - A one-shot, monotonically-tokened `cameraCommand` compatible with
 *    `MapScreen`'s `cameraCommand` prop (`MapCameraCommand`), produced ONLY via
 *    `mapCamera.ts`'s `cameraForPreset` — this hook never invents a camera
 *    target, easing, or timing of its own (spec §3).
 *  - `select`/`deselect` only ever touch `selectedEntityId`; the single
 *    feature this selects is painted by `entity-paint.ts`'s always-mounted
 *    selection layers via `MapScreen`'s memoized `selectedEntityFilter` — this
 *    hook has no path that could re-filter/re-encode the whole source.
 */
import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import {
  cameraForPreset,
  type CameraForPresetInput,
  type CameraPreset,
  type CameraTarget,
} from './mapCamera';
import {
  CINEMATIC_MAP_INITIAL_STATE,
  cinematicMapReducer,
  type CinematicMapState,
} from './cinematic-map-state';

/** Same shape as `MapScreen`'s `MapCameraCommand` — a one-shot, tokened camera move. */
export type CinematicMapCameraCommand = CameraTarget & { readonly token: number };

export type UseCinematicMapOptions = {
  /** The surface's resting camera preset; `close()` flies back here (spec §2 rule 4). */
  readonly homePreset: CameraPreset;
  /** Optional framing input (point/coordinates) for `homePreset`, e.g. a hero location. */
  readonly homeInput?: CameraForPresetInput;
};

export type UseCinematicMapResult = {
  readonly state: CinematicMapState;
  readonly selectedEntityId: string | undefined;
  /** Feed directly into `<MapScreen cameraCommand={cameraCommand} />`. */
  readonly cameraCommand: CinematicMapCameraCommand | undefined;
  /** Rest|Invite -> Engaged. */
  readonly engage: () => void;
  /** Any state -> Rest; deselects and flies back to `homePreset`. */
  readonly close: () => void;
  /** Selects exactly one entity; optionally frames it via the `point` preset. */
  readonly select: (entityId: string, input?: CameraForPresetInput) => void;
  /** Clears selection. Does not move the camera (matches web parity: deselect ≠ fly). */
  readonly deselect: () => void;
  /** Reuses the route's authored camera preset — never invent new easing/timing (spec §3). */
  readonly flyTo: (preset: CameraPreset, input?: CameraForPresetInput) => void;
};

/**
 * Drives the three-state Cinematic Map Backdrop contract (rest|invite|engaged)
 * plus single-feature selection for a mobile map surface. Reuses `mapCamera.ts`
 * exclusively for camera targets; a consuming screen (e.g. the Explore tab,
 * `repo-4v3a.8`) wires `cameraCommand`/`selectedEntityId` straight into
 * `MapScreen` and `reduceMotion` (from `@/ui/useReduceMotion`) into both
 * `MapScreen` and any sheet/scrim chrome, per spec §5b.
 */
export function useCinematicMap({
  homePreset,
  homeInput,
}: UseCinematicMapOptions): UseCinematicMapResult {
  const [reducerState, dispatch] = useReducer(cinematicMapReducer, CINEMATIC_MAP_INITIAL_STATE);
  const cameraSeqRef = useRef(0);
  const [cameraCommand, setCameraCommand] = useState<CinematicMapCameraCommand | undefined>(
    undefined,
  );

  const driveCameraTo = useCallback((target: CameraTarget) => {
    cameraSeqRef.current += 1;
    setCameraCommand({ ...target, token: cameraSeqRef.current });
  }, []);

  const engage = useCallback(() => dispatch({ type: 'engage' }), []);

  const close = useCallback(() => {
    dispatch({ type: 'close' });
    driveCameraTo(cameraForPreset(homePreset, homeInput));
  }, [driveCameraTo, homePreset, homeInput]);

  const select = useCallback(
    (entityId: string, input?: CameraForPresetInput) => {
      dispatch({ type: 'select', entityId });
      if (input) driveCameraTo(cameraForPreset('point', input));
    },
    [driveCameraTo],
  );

  const deselect = useCallback(() => dispatch({ type: 'deselect' }), []);

  const flyTo = useCallback(
    (preset: CameraPreset, input?: CameraForPresetInput) =>
      driveCameraTo(cameraForPreset(preset, input)),
    [driveCameraTo],
  );

  return useMemo(
    () => ({
      state: reducerState.state,
      selectedEntityId: reducerState.selectedEntityId,
      cameraCommand,
      engage,
      close,
      select,
      deselect,
      flyTo,
    }),
    [reducerState, cameraCommand, engage, close, select, deselect, flyTo],
  );
}
