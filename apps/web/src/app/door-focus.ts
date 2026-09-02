/**
 * Door Journey camera focus on the Albers pin plate (no MapLibre).
 *
 * Maps chapter / fact / spotlight targets to a layout zoom into a projected point
 * (width/height/left/top on the board — not CSS transform:scale, which blurs the SVG).
 * Zoom stays capped so the plate never becomes an empty field; reduced-motion
 * callers still get the same frame without a transition.
 */
import { locatorPinPercent } from '../lib/map-experience/albers-usa';
import type { StoryChapter } from '../lib/story/chapters';
import type { StoryRecordSpotlight } from '../lib/story/pick-story-record';
import type { StoryFact } from '../lib/story/story-facts';

/** National framing in chapters.ts (~3.35). Scale 1 = full plate visible. */
const BASE_ZOOM = 3.35;
/** Soften MapLibre zoom deltas so the flat plate stays readable. */
const ZOOM_GAIN = 0.52;
const MAX_SCALE = 7.5;

/** Where the live plate's camera goes for this frame — the chapter's own MapLibre spec. */
export type DoorFocusCamera = {
  readonly center: readonly [lng: number, lat: number];
  readonly zoom: number;
  readonly pitch: number;
  readonly bearing: number;
};

export type DoorFocusFrame = {
  readonly originX: number;
  readonly originY: number;
  readonly scale: number;
  readonly focusEntityId: string | null;
  readonly placeLabel: string;
  /**
   * The same target, for the shared MapLibre plate. `originX`/`originY`/`scale` above are its
   * projection onto the static Albers board, which is only the field until the plate is live.
   */
  readonly camera: DoorFocusCamera;
};

export function zoomToPlateScale(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  const scale = 2 ** ((zoom - BASE_ZOOM) * ZOOM_GAIN);
  return Math.min(MAX_SCALE, Math.max(1, scale));
}

export function resolveDoorFocus(input: {
  readonly chapter: StoryChapter;
  readonly spotlight: StoryRecordSpotlight | null;
  readonly fact: StoryFact | undefined;
  readonly spotlightLngLat?: readonly [number, number] | null;
}): DoorFocusFrame {
  const { chapter, spotlight, fact, spotlightLngLat } = input;

  let lng = chapter.camera.center[0];
  let lat = chapter.camera.center[1];
  let zoom = chapter.camera.zoom;
  let focusEntityId: string | null = null;
  let placeLabel = 'United States';

  if (chapter.focusRandomRecord && spotlight && spotlightLngLat) {
    lng = spotlightLngLat[0];
    lat = spotlightLngLat[1];
    zoom = Math.max(chapter.camera.zoom, 8.5);
    focusEntityId = spotlight.entityId;
    placeLabel = `${spotlight.name}, ${spotlight.place}`;
  } else if (chapter.rotatingFact && fact) {
    lng = fact.camera.center[0];
    lat = fact.camera.center[1];
    zoom = fact.camera.zoom;
    placeLabel = fact.placeLabel;
  }

  const camera: DoorFocusCamera = {
    center: [lng, lat],
    zoom,
    pitch: chapter.camera.pitch,
    bearing: chapter.camera.bearing,
  };

  const projected = locatorPinPercent(lng, lat);
  if (!projected) {
    return {
      originX: 50,
      originY: 50,
      scale: 1,
      focusEntityId,
      placeLabel,
      camera,
    };
  }

  return {
    originX: projected.x,
    originY: projected.y,
    scale: zoomToPlateScale(zoom),
    focusEntityId,
    placeLabel,
    camera,
  };
}
