import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  cameraPresetFor,
  prefersReducedMotion,
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
   * unrequested flight rather than a restored view. */
  readonly mode?: 'fly' | 'ease';
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
 * The only sanctioned way to move the camera (ADR-017: "raw flyTo defaults are banned").
 * Resolves `target` (an explicit center+zoom, or a bounding box via `cameraForBounds`), then
 * flies/eases/jumps according to `name`'s preset and the current reduced-motion state. Returns
 * `false` when `map` isn't constructed yet — callers latch the request and retry on `load`.
 */
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
  } else {
    const [west, south, east, north] = target.bounds;
    const camera = (() => {
      try {
        return map.cameraForBounds([west, south, east, north] as [number, number, number, number], {
          // Honor caller padding (incl. asymmetric hero framing) when fitting bounds.
          padding,
        });
      } catch (error) {
        console.error('[MapStage] cameraForBounds failed', error);
        return undefined;
      }
    })();
    if (camera?.center && typeof camera.zoom === 'number') {
      center = lngLatTuple(camera.center);
      zoom = camera.zoom;
      boundsFitted = true;
    } else {
      center = [(west + east) / 2, (south + north) / 2];
      zoom = 3.4;
    }
  }

  // Bounds fits already encode padding in center/zoom — re-applying padding on
  // ease/fly would double-shift (hero west coast pinned to the copy divider).
  const motionPadding = boundsFitted ? { top: 0, bottom: 0, left: 0, right: 0 } : padding;

  if (reduced || preset.duration <= 0) {
    map.jumpTo({ center, zoom, padding: motionPadding });
    return true;
  }
  if ((options?.mode ?? 'fly') === 'ease') {
    map.easeTo({
      center,
      zoom,
      padding: motionPadding,
      duration: preset.duration,
      easing: preset.easing,
      essential: true,
    });
  } else {
    map.flyTo({
      center,
      zoom,
      padding: motionPadding,
      duration: preset.duration,
      curve: preset.curve,
      speed: preset.speed,
      easing: preset.easing,
      essential: true,
    });
  }
  return true;
}
