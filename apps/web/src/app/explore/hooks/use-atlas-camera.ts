import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { MapStageHandle } from '../../../components/map-stage/MapStage';
import { createCamera } from '../../../lib/map-experience/camera-moves';
import { chromePadding } from '../../../lib/map-experience/chrome-padding';
import { useReducedMotion } from '../../../lib/motion/use-reduced-motion';
import type { LensLayers } from '../../../components/map-experience/LensPanel';
import type { PanelVisibility } from './use-panel-visibility';

/** A beat between the plate being revealed and the establishing shot starting on it. */
const ESTABLISHING_SHOT_DELAY_MS = 400;

/**
 * The camera: the move library bound to the live `MapStage` handle, the announcement readout,
 * the spotlight mask, and the establishing shot that frames the archive on first paint.
 *
 * `map`, in `createCamera`'s deps, is an accessor rather than an instance because the map arrives
 * asynchronously; a no-op stand-in keeps every move safe to call before the canvas is alive.
 */
export function useAtlasCamera(
  stage: MapStageHandle,
  panels: PanelVisibility,
  chromeHidden: boolean,
  sheetOpen: boolean,
  setLayers: Dispatch<SetStateAction<LensLayers>>,
  /**
   * True once a record is selected or about to be (a home pin hand-off, a deep link). The
   * establishing shot never runs over a selection: it used to fire 400ms after a home pin click
   * and throw the reader back to the national view with the inspector open.
   */
  hasSelection: () => boolean,
) {
  const [readout, setReadout] = useState('');
  const [spotlight, setSpotlight] = useState<{ x: number; y: number; radius: number } | null>(null);
  /** The compass needle's live value — every rotate frame, not just settled ones (`rotate` fires
   * far more often than `viewport`; see that event's own doc comment in `listener-store.ts`). */
  const [bearing, setBearing] = useState(0);
  useEffect(() => stage.subscribe('rotate', setBearing), [stage]);

  const paddingRef = useRef({ lens: false, results: false, sheet: false });
  paddingRef.current = {
    lens: panels.lens && !chromeHidden,
    results: panels.results && !chromeHidden,
    sheet: sheetOpen,
  };

  /**
   * Live for the session: a preference flip mid-session must change camera
   * behaviour without a reload. `camera` below is a stable `useMemo` (deps `[stage, setLayers]`,
   * not rebuilt on every render), so its `reducedMotion` callback reads this ref rather than
   * closing over the hook's own render-time boolean directly — the same pattern `paddingRef`
   * already uses just above for the same reason (a stable closure that still needs the latest
   * value at call time, not the value from whenever the memo happened to last rebuild).
   */
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const padFor = useCallback(
    (sheet: boolean) =>
      chromePadding({
        viewportWidth: typeof window === 'undefined' ? 1440 : window.innerWidth,
        viewportHeight: typeof window === 'undefined' ? 900 : window.innerHeight,
        lensOpen: paddingRef.current.lens,
        resultsOpen: paddingRef.current.results,
        sheetOpen: sheet,
      }),
    [],
  );
  /**
   * The chrome visible AFTER a selection: the inspector is open by definition. Passed to
   * `frameRecord` explicitly, because `paddingRef` only learns the sheet is open on the next
   * render, which framed the first selection as if nothing covered it.
   */
  const selectionPadding = useCallback(() => padFor(true), [padFor]);

  const camera = useMemo(
    () =>
      createCamera({
        map: {
          flyTo: (options) => stage.getMap()?.flyTo(options as never),
          easeTo: (options) => stage.getMap()?.easeTo(options as never),
          fitBounds: (bounds, options) =>
            stage.getMap()?.fitBounds(bounds as never, options as never),
          cameraForBounds: (bounds, options) =>
            stage.getMap()?.cameraForBounds(bounds as never, options as never) as never,
          setMinZoom: (zoom) => stage.getMap()?.setMinZoom(zoom),
          getZoom: () => stage.getMap()?.getZoom() ?? 3.6,
          getBearing: () => stage.getMap()?.getBearing() ?? 0,
          getPitch: () => stage.getMap()?.getPitch() ?? 0,
          getCenter: () => stage.getMap()?.getCenter() ?? { lng: -96.5, lat: 38.6 },
          stop: () => stage.getMap()?.stop(),
          // Off-canvas when the map is not alive yet: the record is framed rather than skipped.
          project: (lngLat) => stage.getMap()?.project(lngLat as never) ?? { x: -1, y: -1 },
          getContainer: () => stage.getMap()?.getContainer() ?? { clientWidth: 0, clientHeight: 0 },
        },
        padding: () => padFor(paddingRef.current.sheet),
        reducedMotion: () => reducedMotionRef.current,
        announce: setReadout,
        setRoutes: (visible) => setLayers((current) => ({ ...current, routes: visible })),
        setSpotlight: (target) => {
          if (!target) {
            setSpotlight(null);
            return;
          }
          const point = stage.getMap() as unknown as {
            project?: (lngLat: readonly [number, number]) => { x: number; y: number };
          } | null;
          const projected = point?.project?.(target.center) ?? null;
          setSpotlight(
            projected
              ? { x: projected.x, y: projected.y, radius: target.radiusPercent }
              : { x: 0.5, y: 0.5, radius: target.radiusPercent },
          );
        },
      }),
    [padFor, stage, setLayers],
  );

  /** The camera readout clears itself, so a stale "Orbit" does not sit under the map forever. */
  useEffect(() => {
    if (!readout) return;
    const timer = setTimeout(() => setReadout(''), 2400);
    return () => clearTimeout(timer);
  }, [readout]);

  /**
   * The establishing shot. Start wide, then go deep (§4.2 rule 2) — once the plate has been
   * revealed, not once the canvas has size. The first-paint board is drawn at the plate's opening
   * frame (explore-map-underlay.css), so the handoff is two identical pictures crossfading; a
   * shot that started before the reveal was seen mid-flight through that fade, and on a cold load
   * a mount-timed shot can fire before MapLibre exists and never run. `ready` replays for a plate
   * revealed on an earlier page, so arriving from the
   * Door still gets the shot. Under reduced motion the shot is a cut and takes no beat.
   */
  const framed = useRef(false);
  const hasSelectionRef = useRef(hasSelection);
  hasSelectionRef.current = hasSelection;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = stage.subscribe('ready', () => {
      if (framed.current) return;
      framed.current = true;
      if (hasSelectionRef.current()) return;
      const delay = reducedMotionRef.current ? 0 : ESTABLISHING_SHOT_DELAY_MS;
      timer = setTimeout(() => {
        // Checked again at fire time: a selection made during the beat wins.
        if (!hasSelectionRef.current()) camera.wide({ trigger: 'ambient' });
      }, delay);
    });
    return () => {
      unsubscribe();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [camera, stage]);

  return { camera, readout, spotlight, setSpotlight, bearing, selectionPadding } as const;
}
