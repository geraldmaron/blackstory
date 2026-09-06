/**
 * Door Journey focus: the frame the shared plate holds for a chapter.
 *
 * A chapter, its rotating fact, or the visit's spotlight record resolve to one MapLibre camera
 * spec, the record the plate rings, and the place name the live region announces. There is no
 * second target any more: the static Albers board this module used to layout-zoom is gone
 * (repo-18ma2) and the live plate is the only map on `/`, so a frame is a camera and nothing else.
 */
import type { StoryChapter } from '../lib/story/chapters';
import type { StoryRecordSpotlight } from '../lib/story/pick-story-record';
import type { StoryFact } from '../lib/story/story-facts';

/** Where the live plate's camera goes for this frame — the chapter's own MapLibre spec. */
export type DoorFocusCamera = {
  readonly center: readonly [lng: number, lat: number];
  readonly zoom: number;
  readonly pitch: number;
  readonly bearing: number;
};

export type DoorFocusFrame = {
  /** The record the plate rings for this frame (the chapter spotlight), or nothing. */
  readonly focusEntityId: string | null;
  /** What the live region announces when the frame changes. */
  readonly placeLabel: string;
  readonly camera: DoorFocusCamera;
};

/** The spotlight chapter pushes in at least this close, whatever the chapter's own zoom says. */
const SPOTLIGHT_MIN_ZOOM = 8.5;

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
    zoom = Math.max(chapter.camera.zoom, SPOTLIGHT_MIN_ZOOM);
    focusEntityId = spotlight.entityId;
    placeLabel = `${spotlight.name}, ${spotlight.place}`;
  } else if (chapter.rotatingFact && fact) {
    lng = fact.camera.center[0];
    lat = fact.camera.center[1];
    zoom = fact.camera.zoom;
    placeLabel = fact.placeLabel;
  }

  return {
    focusEntityId,
    placeLabel,
    camera: {
      center: [lng, lat],
      zoom,
      pitch: chapter.camera.pitch,
      bearing: chapter.camera.bearing,
    },
  };
}
