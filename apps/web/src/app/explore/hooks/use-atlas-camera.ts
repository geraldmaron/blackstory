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
import { createCamera, type CameraMove } from '../../../lib/map-experience/camera-moves';
import { chromePadding } from '../../../lib/map-experience/chrome-padding';
import { prefersReducedMotion } from '../../../lib/map-experience/camera-presets';
import { MIGRATION_CORRIDORS } from '../../../lib/map-experience/migration-corridors';
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

  const camera = useMemo(
    () =>
      createCamera({
        map: {
          flyTo: (options) => stage.getMap()?.flyTo(options as never),
          easeTo: (options) => stage.getMap()?.easeTo(options as never),
          fitBounds: (bounds, options) =>
            stage.getMap()?.fitBounds(bounds as never, options as never),
          getZoom: () => stage.getMap()?.getZoom() ?? 3.6,
          getBearing: () => stage.getMap()?.getBearing() ?? 0,
          getPitch: () => stage.getMap()?.getPitch() ?? 0,
          getCenter: () => stage.getMap()?.getCenter() ?? { lng: -96.5, lat: 38.6 },
          stop: () => stage.getMap()?.stop(),
        },
        padding: () =>
          chromePadding({
            viewportWidth: typeof window === 'undefined' ? 1440 : window.innerWidth,
            viewportHeight: typeof window === 'undefined' ? 900 : window.innerHeight,
            lensOpen: paddingRef.current.lens,
            resultsOpen: paddingRef.current.results,
            sheetOpen: paddingRef.current.sheet,
          }),
        reducedMotion: prefersReducedMotion,
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
    [stage, setLayers],
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
   * the old 400ms-after-mount timer fired before MapLibre existed and the shot never ran at all
   * (repo-27uao). `ready` replays for a plate revealed on an earlier page, so arriving from the
   * Door still gets the shot. Under reduced motion the shot is a cut and takes no beat.
   */
  const framed = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = stage.subscribe('ready', () => {
      if (framed.current) return;
      framed.current = true;
      const delay = prefersReducedMotion() ? 0 : ESTABLISHING_SHOT_DELAY_MS;
      timer = setTimeout(() => camera.wide({ trigger: 'ambient' }), delay);
    });
    return () => {
      unsubscribe();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [camera, stage]);

  const runMove = useCallback(
    (move: CameraMove) => {
      const options = { trigger: 'reader' as const };
      if (move === 'wide') camera.wide(options);
      else if (move === 'push') camera.push(options);
      else if (move === 'orbit') camera.orbit(options);
      else if (move === 'tilt') camera.tilt(options);
      else if (move === 'spotlight') camera.spotlight(options);
      else if (move === 'trace')
        camera.trace({ ...options, corridorCount: MIGRATION_CORRIDORS.length });
    },
    [camera],
  );

  return { camera, readout, spotlight, setSpotlight, runMove, bearing } as const;
}
