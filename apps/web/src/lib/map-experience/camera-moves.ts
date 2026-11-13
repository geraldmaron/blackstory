/**
 * The six cinematic camera moves, as a library over an injected map handle.
 *
 * This extends `camera-presets.ts` rather than replacing it: the slow-out easing, the zoom
 * envelope and the reduced-motion posture all come from there. What this module adds is the
 * *vocabulary* — wide, push, orbit, tilt, spotlight, trace — plus `frameRecord`, the one
 * selection contract every surface uses to show a record (home, /explore, embeds).
 *
 * No `maplibre-gl` runtime import. The map is a structural `MapLike`, the same split
 * `camera-presets.ts` / `kind-encoding.ts` already use, so the whole move set
 * is unit-testable in plain Node against a recording fake.
 *
 * Three rules here are not stylistic and must not be tuned per call site:
 *   1. every `flyTo` carries `curve: 1.42` (van Wijk 2003, MapLibre's documented default rationale)
 *   2. every `fitBounds` is wrapped, because MapLibre throws when padding exceeds the canvas and
 *      that throw kills map init
 *   3. `essential: true` marks only reader-triggered moves, never ambient or scroll-driven ones
 */

import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import {
  CAMERA_EASING_SLOW_OUT,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  type CameraEasing,
} from './camera-presets';
import { isMoveAllowed, type RecordLike as DignityRecord } from './camera-dignity';
import type { ChromeInset } from './chrome-padding';
import { zoomForLocationPrecision } from './geo-precision';

export type CameraMove = 'wide' | 'push' | 'orbit' | 'tilt' | 'spotlight' | 'trace' | 'frameRecord';

/** What `frameArea` lands on: an explicit box (a search radius, or "you plus your nearest
 * records"), or a single point at a zoom. */
export type AreaFrame =
  | { readonly kind: 'bounds'; readonly bounds: readonly [LngLat, LngLat]; readonly label: string }
  | {
      readonly kind: 'center';
      readonly center: LngLat;
      readonly zoom?: number;
      readonly label: string;
    };

export type LngLat = readonly [longitude: number, latitude: number];

/** `flyTo`'s zoom curve. Fixed by §4.2 rule 1. */
export const CAMERA_FLY_CURVE = 1.42;

/** Where a failed `fitBounds` lands instead of throwing. */
export const CAMERA_FALLBACK_CENTER: LngLat = [-96.5, 38.6];
export const CAMERA_FALLBACK_ZOOM = 3.6;

export const CAMERA_MOVE_DURATIONS = {
  wide: 1500,
  push: 1600,
  orbit: 5200,
  tilt: 900,
  spotlight: 720,
  trace: 900,
  frameRecord: 900,
} as const satisfies Record<CameraMove, number>;

/** Pitch the tilt move toggles between. */
const TILT_PITCH = 55;
const TILT_FLAT_THRESHOLD = 20;

/** How long `resetBearing`'s ease takes to bring the plate back to north. Shorter than `tilt`'s
 * — this is a correction, not a establishing move, and should read as a snap-back, not a shot. */
const RESET_BEARING_DURATION_MS = 500;
/** Orbit raises the plate before rotating, so the rotation reads as orbit rather than spin. */
const ORBIT_PITCH = 46;
const ORBIT_PITCH_THRESHOLD = 24;
const ORBIT_PITCH_DURATION = 700;
const ORBIT_START_DELAY = 320;
const ORBIT_DEFAULT_DEGREES = 60;

const PUSH_PITCH = 48;
const PUSH_ZOOM_STEP = 2.6;
const PUSH_MIN_ZOOM = 8.4;

/** Locate framing: neighbourhood scale, north-up, flat — what every maps app does for "you". */
export const LOCATE_ZOOM = 13.2;
const LOCATE_DURATION = 1400;

const SPOTLIGHT_DEFAULT_RADIUS_PERCENT = 20;

/** Linear easing. An orbit that eases would read as a nervous drift, not a steady rotation. */
const LINEAR_EASING: CameraEasing = (t) => t;

/**
 * The selection contract's decision, pure so it is testable without a map.
 *
 * Target zoom comes from the record's stored precision (`zoomForLocationPrecision`). The camera
 * never zooms OUT from a closer view the reader chose, and does not move at all when the mark is
 * already inside the unobscured bounds at or above that zoom. Otherwise it makes one
 * `frameRecord`-length ease-out move, or a cut under reduced motion. `null` means stay put.
 */
export function planRecordFrame(input: {
  readonly precision: string;
  readonly currentZoom: number;
  readonly markInView: boolean;
  readonly reducedMotion: boolean;
}): { readonly zoom: number; readonly duration: number } | null {
  const target = Math.min(zoomForLocationPrecision(input.precision), MAP_MAX_ZOOM);
  if (input.markInView && input.currentZoom >= target) return null;
  return {
    zoom: Math.max(input.currentZoom, target),
    duration: input.reducedMotion ? 0 : CAMERA_MOVE_DURATIONS.frameRecord,
  };
}

/** True when a projected point sits inside the canvas minus the chrome that covers it. */
export function pointInVisibleBounds(
  point: { readonly x: number; readonly y: number },
  size: { readonly width: number; readonly height: number },
  inset: ChromeInset,
): boolean {
  return (
    point.x >= inset.left &&
    point.x <= size.width - inset.right &&
    point.y >= inset.top &&
    point.y <= size.height - inset.bottom
  );
}

export type CameraAnimationOptions = {
  center?: LngLat;
  zoom?: number;
  pitch?: number;
  bearing?: number;
  duration?: number;
  curve?: number;
  speed?: number;
  easing?: CameraEasing;
  padding?: ChromeInset;
  maxZoom?: number;
  essential?: boolean;
};

/** Minimal structural view of the MapLibre map this library drives. */
export type MapLike = {
  flyTo(options: CameraAnimationOptions): unknown;
  easeTo(options: CameraAnimationOptions): unknown;
  fitBounds(bounds: readonly [LngLat, LngLat], options: CameraAnimationOptions): unknown;
  getZoom(): number;
  getBearing(): number;
  getPitch(): number;
  getCenter(): LngLat | { lng: number; lat: number };
  /** Cancels an in-flight camera animation. */
  stop?(): unknown;
  /** Fitted camera for a box, unclamped by the zoom floor. Absent on a bare fake. */
  cameraForBounds?(
    bounds: readonly [LngLat, LngLat],
    options: { padding: ChromeInset },
  ): { zoom?: number } | undefined;
  setMinZoom?(zoom: number): unknown;
  /** Screen position of a coordinate, for the "already visible" test. Absent on a bare fake. */
  project?(lngLat: LngLat): { x: number; y: number };
  getContainer?(): { clientWidth: number; clientHeight: number };
};

export type SpotlightTarget = { center: LngLat; radiusPercent: number } | null;

export type CameraDeps = {
  map: MapLike;
  padding: () => ChromeInset;
  reducedMotion: () => boolean;
  /** Camera readout, `role="status"`. Receives the `"Move · detail"` shape. */
  announce: (text: string) => void;
  /** Spotlight is a CSS mask, not a camera change, so the surface owns it. */
  setSpotlight?: (target: SpotlightTarget) => void;
  /** Corridor overlay visibility for the trace move. */
  setRoutes?: (visible: boolean) => void;
  /** Injected so orbit's staged rotation is testable without real timers. */
  scheduler?: (callback: () => void, delayMs: number) => unknown;
  cancelScheduled?: (handle: unknown) => void;
  /**
   * The record the camera is currently acting on, if any. Supplying it engages the dignity gate
   * (`camera-dignity.ts`): a move this record refuses becomes a silent no-op. Omit it and moves
   * are ungated, which is correct for pure geography — a wide shot is not about anyone.
   */
  activeRecord?: () => DignityRecord | null | undefined;
};

/**
 * Who asked for the move. Reader-triggered moves set `essential: true` so the browser does not
 * suppress them; ambient ones must stay suppressible, which is the whole point of the flag.
 */
export type CameraTrigger = 'reader' | 'ambient';

export type MoveOptions = {
  readonly trigger?: CameraTrigger;
  readonly durationMs?: number;
};

export type PushOptions = MoveOptions & { readonly target?: LngLat; readonly label?: string };
export type OrbitOptions = MoveOptions & { readonly degrees?: number };
export type SpotlightOptions = MoveOptions & {
  readonly center?: LngLat;
  readonly radiusPercent?: number;
};
export type TraceOptions = MoveOptions & { readonly corridorCount?: number };

export type RecordFrameTarget = {
  readonly center: LngLat;
  /** The record's stored public precision (`ExploreMapFeatureProperties.precision`). */
  readonly precision: string;
  /** Place name for the readout, e.g. "Birmingham, Alabama". */
  readonly place: string;
};

export type FrameRecordOptions = MoveOptions & {
  /** The chrome that will be visible AFTER the selection (the open inspector included). */
  readonly padding?: ChromeInset;
};

export type CameraApi = {
  wide(options?: MoveOptions): void;
  push(options?: PushOptions): void;
  orbit(options?: OrbitOptions): void;
  tilt(options?: MoveOptions): void;
  spotlight(options?: SpotlightOptions): void;
  trace(options?: TraceOptions): void;
  /** The selection contract: every pin click, list row, prev/next and deep link lands here. */
  frameRecord(record: RecordFrameTarget, options?: FrameRecordOptions): void;
  /**
   * Frames a place the reader asked to see — their own location, a searched address, a radius.
   * Pure geography, so it is never dignity-gated: it is not about any record.
   */
  frameArea(frame: AreaFrame, options?: MoveOptions): void;
  /** Straightens the plate to north, holding center/zoom/pitch. Ungated — never refused by the
   * dignity gate. */
  resetBearing(options?: MoveOptions): void;
  /** Cancels any in-flight scripted move. Reader input always wins (§4.2 rule 7). */
  cancel(): void;
  /** True while the spotlight mask is up. */
  isSpotlit(): boolean;
};

function toLngLat(center: LngLat | { lng: number; lat: number }): LngLat {
  return 'lng' in center ? [center.lng, center.lat] : center;
}

export function createCamera(deps: CameraDeps): CameraApi {
  const { map, padding, reducedMotion, announce } = deps;
  const schedule = deps.scheduler ?? ((cb: () => void, ms: number) => setTimeout(cb, ms));
  const unschedule = deps.cancelScheduled ?? ((handle: unknown) => clearTimeout(handle as never));

  let pending: unknown = null;
  let spotlit = false;

  /** Reduced motion collapses every duration to zero and cuts to the destination. */
  const durationFor = (requested: number | undefined, fallback: number): number =>
    reducedMotion() ? 0 : (requested ?? fallback);

  const isEssential = (options: MoveOptions | undefined): boolean =>
    (options?.trigger ?? 'reader') === 'reader';

  /**
   * The dignity gate. A refused move is a silent no-op with a dev-only warning, never a
   * user-facing error: the reader pressed a key, and telling them the archive has opinions about
   * their keystroke would be worse than simply not moving.
   */
  function refused(move: CameraMove): boolean {
    const record = deps.activeRecord?.();
    if (isMoveAllowed(move, record)) return false;
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[camera] "${move}" refused by the dignity gate for this record (design-direction-v9-atlas.md §4.3)`,
      );
    }
    return true;
  }

  function clearPending(): void {
    if (pending !== null) {
      unschedule(pending);
      pending = null;
    }
  }

  function cancel(): void {
    clearPending();
    map.stop?.();
  }

  function wide(options?: MoveOptions): void {
    cancel();
    setSpotlight(null);
    const duration = durationFor(options?.durationMs, CAMERA_MOVE_DURATIONS.wide);
    const [west, south, east, north] = US_CONUS_BOUNDS;
    const bounds: readonly [LngLat, LngLat] = [
      [west, south],
      [east, north],
    ];

    const inset = padding();
    // On a phone the country is narrower than the national floor (`MAP_MIN_ZOOM`) allows, and
    // fitBounds clamps to the floor, which crops the west coast. Sink the floor to the fit, the
    // way the Door's strip does (`zoomFloor: 'fit'`, map-stage/camera.ts).
    try {
      const fitted = map.cameraForBounds?.(bounds, { padding: inset })?.zoom;
      if (typeof fitted === 'number' && fitted < MAP_MIN_ZOOM) map.setMinZoom?.(fitted);
    } catch {
      // Same throw as fitBounds below; that call owns the fallback.
    }

    try {
      map.fitBounds(bounds, {
        padding: inset,
        duration,
        pitch: 0,
        bearing: 0,
        essential: isEssential(options),
      });
    } catch {
      // MapLibre throws when the requested padding will not fit the canvas. The clamp in
      // chrome-padding.ts makes that unlikely, but a throw here would kill map init outright,
      // so the establishing shot degrades to a plain ease rather than taking the surface down.
      map.easeTo({
        center: CAMERA_FALLBACK_CENTER,
        zoom: CAMERA_FALLBACK_ZOOM,
        pitch: 0,
        bearing: 0,
        duration,
        essential: isEssential(options),
      });
    }
    // The page-load establishing shot is ambient: nobody asked for it, so it does not print
    // camera jargon ("Wide · continental") under a map the reader has not touched yet.
    if (isEssential(options)) announce('Wide · continental');
  }

  function push(options?: PushOptions): void {
    if (refused('push')) return;
    cancel();
    const center = options?.target ?? toLngLat(map.getCenter());
    map.flyTo({
      center,
      zoom: Math.max(map.getZoom() + PUSH_ZOOM_STEP, PUSH_MIN_ZOOM),
      pitch: PUSH_PITCH,
      bearing: map.getBearing(),
      curve: CAMERA_FLY_CURVE,
      speed: 0.85,
      easing: CAMERA_EASING_SLOW_OUT,
      duration: durationFor(options?.durationMs, CAMERA_MOVE_DURATIONS.push),
      essential: isEssential(options),
    });
    announce(`Push in · ${options?.label ?? 'center'}`);
  }

  function orbit(options?: OrbitOptions): void {
    if (refused('orbit')) return;
    cancel();
    const degrees = options?.degrees ?? ORBIT_DEFAULT_DEGREES;
    const duration = durationFor(options?.durationMs, CAMERA_MOVE_DURATIONS.orbit);
    const essential = isEssential(options);

    if (map.getPitch() < ORBIT_PITCH_THRESHOLD) {
      map.easeTo({
        pitch: ORBIT_PITCH,
        duration: reducedMotion() ? 0 : ORBIT_PITCH_DURATION,
        essential,
      });
    }

    const rotate = () => {
      pending = null;
      map.easeTo({
        bearing: map.getBearing() + degrees,
        duration,
        easing: LINEAR_EASING,
        essential,
      });
    };

    // Under reduced motion there is nothing to stage, so the rotation lands immediately.
    if (reducedMotion()) rotate();
    else pending = schedule(rotate, ORBIT_START_DELAY);

    announce(`Orbit · ${degrees} degrees`);
  }

  function tilt(options?: MoveOptions): void {
    cancel();
    const flat = map.getPitch() < TILT_FLAT_THRESHOLD;
    map.easeTo({
      pitch: flat ? TILT_PITCH : 0,
      duration: durationFor(options?.durationMs, CAMERA_MOVE_DURATIONS.tilt),
      easing: CAMERA_EASING_SLOW_OUT,
      essential: isEssential(options),
    });
    announce(flat ? `Tilt · ${TILT_PITCH} degrees` : 'Tilt · flat');
  }

  function setSpotlight(target: SpotlightTarget): void {
    spotlit = target !== null;
    deps.setSpotlight?.(target);
  }

  function spotlight(options?: SpotlightOptions): void {
    // Refused before the toggle, so a gated record cannot even turn an existing spotlight off
    // onto itself and back on.
    if (refused('spotlight')) return;
    // Deliberately no camera call: spotlight isolates without moving (§4.1).
    if (spotlit) {
      setSpotlight(null);
      announce('Spotlight · off');
      return;
    }
    const center = options?.center ?? toLngLat(map.getCenter());
    setSpotlight({
      center,
      radiusPercent: options?.radiusPercent ?? SPOTLIGHT_DEFAULT_RADIUS_PERCENT,
    });
    announce('Spotlight · on');
  }

  function trace(options?: TraceOptions): void {
    if (refused('trace')) return;
    // Start wide, then draw. A trace that begins mid-zoom shows movement without its geography.
    wide({ ...(options?.trigger ? { trigger: options.trigger } : {}) });
    deps.setRoutes?.(true);
    const count = options?.corridorCount;
    announce(count === undefined ? 'Trace · corridors' : `Trace · ${count} corridors`);
  }

  /**
   * Straightens the plate to north, holding center, zoom and pitch. Not one of the six gated
   * moves (design-direction-v9-atlas.md §5.5's grid is locked to those six) — this is the
   * compass control's own action, and it is never refused: undoing a rotation is not camera
   * drama, it is returning the map to its resting orientation.
   */
  function resetBearing(options?: MoveOptions): void {
    cancel();
    map.easeTo({
      bearing: 0,
      duration: durationFor(options?.durationMs, RESET_BEARING_DURATION_MS),
      easing: CAMERA_EASING_SLOW_OUT,
      essential: isEssential(options),
    });
    announce('North · reset');
  }

  function frameArea(frame: AreaFrame, options?: MoveOptions): void {
    cancel();
    setSpotlight(null);
    const duration = durationFor(options?.durationMs, LOCATE_DURATION);
    const essential = isEssential(options);
    if (frame.kind === 'bounds') {
      try {
        map.fitBounds(frame.bounds, {
          padding: padding(),
          duration,
          pitch: 0,
          bearing: 0,
          maxZoom: MAP_MAX_ZOOM,
          easing: CAMERA_EASING_SLOW_OUT,
          essential,
        });
      } catch {
        const [[west, south], [east, north]] = frame.bounds;
        map.easeTo({
          center: [(west + east) / 2, (south + north) / 2],
          zoom: LOCATE_ZOOM - 2,
          pitch: 0,
          bearing: 0,
          duration,
          essential,
        });
      }
    } else {
      map.flyTo({
        center: frame.center,
        zoom: frame.zoom ?? LOCATE_ZOOM,
        pitch: 0,
        bearing: 0,
        curve: CAMERA_FLY_CURVE,
        speed: 1.1,
        easing: CAMERA_EASING_SLOW_OUT,
        duration,
        padding: padding(),
        essential,
      });
    }
    announce(`Locate · ${frame.label}`);
  }

  function markInView(center: LngLat, inset: ChromeInset): boolean {
    const point = map.project?.(center);
    const container = map.getContainer?.();
    if (!point || !container) return false;
    return pointInVisibleBounds(
      point,
      { width: container.clientWidth, height: container.clientHeight },
      inset,
    );
  }

  function frameRecord(record: RecordFrameTarget, options?: FrameRecordOptions): void {
    const inset = options?.padding ?? padding();
    const plan = planRecordFrame({
      precision: record.precision,
      currentZoom: map.getZoom(),
      markInView: markInView(record.center, inset),
      reducedMotion: reducedMotion(),
    });
    if (!plan) return;
    cancel();
    // Pitch and bearing are left out on purpose: the reader's tilt and turn survive a selection.
    map.easeTo({
      center: record.center,
      zoom: plan.zoom,
      duration: plan.duration,
      easing: CAMERA_EASING_SLOW_OUT,
      padding: inset,
      essential: isEssential(options),
    });
    announce(`Record · ${record.place}`);
  }

  return {
    wide,
    push,
    orbit,
    tilt,
    spotlight,
    trace,
    frameRecord,
    frameArea,
    resetBearing,
    cancel,
    isSpotlit: () => spotlit,
  };
}
