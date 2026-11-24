import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  cameraPresetFor,
  flightDurationFor,
  flightPeakZoom,
  MAP_MIN_ZOOM,
  prefersReducedMotion,
  screensBetween,
  type CameraPresetName,
} from '../../lib/map-experience/camera-presets';
import { lngLatTuple } from './viewport-geometry';

export type CameraFlyTarget =
  | { readonly center: readonly [lng: number, lat: number]; readonly zoom: number }
  | { readonly bounds: readonly [west: number, south: number, east: number, north: number] };

export type MapStageFlyOptions = {
  /** `'fly'` (default): cinematic arc, used for hero-engagement descents. `'ease'`: linear
   * pan/zoom with the same authored duration/easing but no arc — used to reconcile the camera
   * against a URL viewport (deep link, back/forward), where a swooping arc would read as an
   * unrequested flight rather than a restored view. `'cut'`: no motion at all — the preset frame
   * lands in one step, motion preference aside. For a frame the reader must not see arrive: the
   * Door's first frame after mount, and a window resize, where the plate has to follow the
   * layout the way the layout itself moves. */
  readonly mode?: 'fly' | 'ease' | 'cut';
  /**
   * `'fit'`: a bounds fit may sink the plate's zoom floor to the fitted zoom. The Door's phone
   * strip is shorter than the country at the Instrument's national floor (`MAP_MIN_ZOOM`), and a
   * zoom the transform clamps under a center computed for the unclamped zoom lands the country
   * outside the strip. The floor goes back to `MAP_MIN_ZOOM` as soon as a fit no
   * longer needs less, and whenever the plate leaves the Door's ambient posture (MapStage.tsx);
   * reader-driven zoom is locked on the strip anyway.
   */
  readonly zoomFloor?: 'fit';
  /**
   * Camera attitude to land in, when the caller's framing is not merely a center/zoom.
   *
   * Omitted, MapLibre keeps whatever pitch/bearing the camera already holds — which is correct
   * for a reader who tilted the plate by hand and then asked for a preset frame, and wrong for
   * any surface whose frames are authored. The Door's chapters author all four numbers, so a
   * scroll back up to a flat national chapter has to be able to say "flat", or the tilt and
   * rotation of the tilted chapter it came from survive the move and the field stays contorted
   * at the top of the page.
   */
  readonly pitch?: number;
  readonly bearing?: number;
  /** Override uniform preset padding — e.g. clear the right results rail for a selected point. */
  readonly padding?:
    | number
    | {
        readonly top: number;
        readonly bottom: number;
        readonly left: number;
        readonly right: number;
      };
};

/**
 * The sanctioned route for PRESET framing, and the only camera path that reads
 * `camera-presets.ts` directly. Raw library defaults are policy-banned; `camera-moves.ts`
 * is the other sanctioned caller and authors its own duration, curve and easing. One call
 * site still runs on bare library defaults today: `MapStage.tsx`'s own MapMoment framing
 * effect (`docs/decisions-carryover.md`, "Persistent map canvas": camera grammar). Nothing
 * lints any of this.
 * Resolves `target` (an explicit center+zoom, or a bounding box via `cameraForBounds`), then
 * flies/eases/jumps according to `name`'s preset and the current reduced-motion state. Returns
 * `false` when `map` isn't constructed yet: callers latch the request and retry on `load`.
 */
const ZERO_PADDING = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * `map.cameraForBounds`, safe to call from any camera state. Returns undefined when there is no
 * usable fit, so every caller needs its own fallback frame.
 *
 * MapLibre fits bounds inside the padding it is given PLUS whatever padding the camera already
 * holds (`cameraForBoxAndBearing`: `tr.padding + options.padding`). A center-and-zoom flight
 * leaves its padding on the camera, so the next fit was padded twice: after the Door's Orbit the
 * decade walk fitted the country into a 69px sliver and landed on Hudson Bay at zoom 1.8 with no
 * record on screen. When the two paddings together exceed the canvas the globe helper throws
 * outright (it reads `.center` off a fit that came back undefined), which is what a place click
 * on the Door did. So the fit is computed with no padding on the camera, and a throw or a
 * non-finite zoom (a map with no size yet, a background tab) is no fit. Nothing renders between
 * the two writes: the held padding is back before this returns.
 */
export function fitBoundsCamera<Center>(
  // Structural, so the stage's `AtlasCameraTarget` fits as well as the MapLibre map.
  map: {
    cameraForBounds(bounds: never, options: never): { center?: Center; zoom?: number } | undefined;
  },
  [west, south, east, north]: readonly [number, number, number, number],
  padding: number | typeof ZERO_PADDING | undefined,
): { center: Center | undefined; zoom: number } | undefined {
  const transform = (map as { transform?: unknown }).transform as
    { padding?: typeof ZERO_PADDING; setPadding?(p: typeof ZERO_PADDING): void } | undefined;
  const held = transform?.padding ? { ...transform.padding } : null;
  try {
    if (held) transform!.setPadding?.(ZERO_PADDING);
    const fit = map.cameraForBounds(
      [west, south, east, north] as never,
      (padding === undefined ? {} : { padding }) as never,
    );
    return typeof fit?.zoom === 'number' && Number.isFinite(fit.zoom)
      ? { center: fit.center, zoom: fit.zoom }
      : undefined;
  } catch (error) {
    console.error('[MapStage] cameraForBounds failed', error);
    return undefined;
  } finally {
    if (held) transform!.setPadding?.(held);
  }
}

export function runFlyPreset(
  map: MapLibreMap | null,
  name: CameraPresetName,
  target: CameraFlyTarget,
  options?: MapStageFlyOptions,
): boolean {
  if (!map) return false;
  const reduced = prefersReducedMotion();
  const preset = cameraPresetFor(name, reduced);

  const paddingOption = options?.padding ?? preset.padding;
  const padding =
    typeof paddingOption === 'number'
      ? { top: paddingOption, bottom: paddingOption, left: paddingOption, right: paddingOption }
      : paddingOption;

  let center: [number, number];
  let zoom: number;
  /** When true, `padding` was already baked into center/zoom via `cameraForBounds`. */
  let boundsFitted = false;
  if ('center' in target) {
    center = [target.center[0], target.center[1]];
    zoom = target.zoom;
    if (options?.zoomFloor === 'fit') map.setMinZoom(Math.min(MAP_MIN_ZOOM, zoom));
  } else {
    const [west, south, east, north] = target.bounds;
    // Honor caller padding (incl. asymmetric hero framing) when fitting bounds.
    const camera = fitBoundsCamera(map, target.bounds, padding);
    if (camera?.center) {
      center = lngLatTuple(camera.center);
      zoom = camera.zoom;
      boundsFitted = true;
      // MapLibre throws below its own floor of -2.
      if (options?.zoomFloor === 'fit') map.setMinZoom(Math.max(-2, Math.min(MAP_MIN_ZOOM, zoom)));
    } else {
      center = [(west + east) / 2, (south + north) / 2];
      zoom = 3.4;
    }
  }

  // Bounds fits already encode padding in center/zoom — re-applying padding on
  // ease/fly would double-shift (hero west coast pinned to the copy divider).
  const motionPadding = boundsFitted ? ZERO_PADDING : padding;

  /** Only the attitude the caller actually authored — an absent one stays untouched. */
  const attitude = {
    ...(options?.pitch === undefined ? {} : { pitch: options.pitch }),
    ...(options?.bearing === undefined ? {} : { bearing: options.bearing }),
  };

  if (reduced || preset.duration <= 0 || options?.mode === 'cut') {
    map.jumpTo({ center, zoom, padding: motionPadding, ...attitude });
    return true;
  }
  if ((options?.mode ?? 'fly') === 'ease') {
    map.easeTo({
      center,
      zoom,
      padding: motionPadding,
      ...attitude,
      duration: preset.duration,
      easing: preset.easing,
      essential: true,
    });
  } else {
    const from = map.getZoom();
    const screens = screensBetween(map.getCenter(), center, from, map.getContainer().clientWidth);
    map.flyTo({
      center,
      zoom,
      padding: motionPadding,
      ...attitude,
      duration: flightDurationFor(preset.duration, from, zoom, screens),
      // The top of the arc, by distance (`flightPeakZoom`).
      minZoom: flightPeakZoom(from, zoom, screens),
      curve: preset.curve,
      speed: preset.speed,
      easing: preset.easing,
      essential: true,
    });
  }
  return true;
}
