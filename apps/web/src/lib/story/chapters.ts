/**
 * The six story chapters, as data.
 *
 * A chapter is a camera position plus a set of beats the surface turns on when the chapter is in
 * view. Keeping it as data rather than JSX is what makes the sequence testable: the assertion that
 * chapter 3 carries the corridor honesty line, or that no chapter asks for a move the dignity gate
 * refuses, is a unit test here rather than a review comment on a component.
 *
 * Design law: docs/ui/design-direction-v9-atlas.md §6.
 */

import { MIGRATION_CORRIDOR_NOTE } from '../map-experience/migration-corridors';
import type { LngLat } from '../map-experience/camera-moves';

/** Where the camera sits for a chapter. Cut to, not flown to, under reduced motion. */
export type ChapterCamera = {
  readonly center: LngLat;
  readonly zoom: number;
  readonly pitch: number;
  readonly bearing: number;
};

export type ChapterFact = {
  readonly value: string;
  readonly label: string;
};

export type StoryChapter = {
  /** 0-based, and 0 is the cold open. */
  readonly index: number;
  readonly id: string;
  readonly camera: ChapterCamera;
  /** Centred card, no index badge. The cold open and the outro. */
  readonly centred: boolean;
  /** Radial spotlight over the chapter's own centre, as a percentage radius. */
  readonly spotlightRadiusPercent?: number;
  /** Draw the migration corridors. */
  readonly routes?: boolean;
  /** Run the decade sweep while this chapter is in view. */
  readonly sweep?: boolean;
  /** Select and pin a specific record. */
  readonly focusRecordId?: string;
};

/**
 * `threshold: 0.42` against the story scroll container. Low enough that a chapter fires before it
 * is fully centred (the camera needs a head start), high enough that a chapter clipping the
 * viewport edge does not steal the camera from the one the reader is reading.
 */
export const CHAPTER_INTERSECTION_THRESHOLD = 0.42;

export const STORY_CHAPTERS: readonly StoryChapter[] = [
  {
    index: 0,
    id: 'cold-open',
    camera: { center: [-96.5, 38.6], zoom: 3.35, pitch: 0, bearing: 0 },
    centred: true,
  },
  {
    index: 1,
    id: 'thickest',
    camera: { center: [-90.05, 32.3], zoom: 5.1, pitch: 34, bearing: -14 },
    centred: false,
    spotlightRadiusPercent: 20,
  },
  {
    index: 2,
    id: 'one-record',
    camera: { center: [-86.81, 33.52], zoom: 13.4, pitch: 56, bearing: 24 },
    centred: false,
    focusRecordId: 'ent_gaston_motel_001',
  },
  {
    index: 3,
    id: 'migration',
    camera: { center: [-88.2, 37.6], zoom: 4.05, pitch: 42, bearing: 0 },
    centred: false,
    routes: true,
  },
  {
    index: 4,
    id: 'four-centuries',
    camera: { center: [-95.2, 39.2], zoom: 3.5, pitch: 0, bearing: 0 },
    centred: false,
    sweep: true,
  },
  {
    index: 5,
    id: 'your-turn',
    camera: { center: [-96.5, 38.6], zoom: 3.4, pitch: 0, bearing: 0 },
    centred: true,
  },
];

/** The corridor chapter. Its honesty line is required copy, so the test can find it by id. */
export const CORRIDOR_CHAPTER_ID = 'migration';

export function chapterById(id: string): StoryChapter | undefined {
  return STORY_CHAPTERS.find((chapter) => chapter.id === id);
}

/**
 * The honesty line chapter 3 must carry, taken from the corridor data rather than retyped.
 * A second copy of this sentence could soften while the data stayed the same.
 */
export const CORRIDOR_HONESTY_LINE = MIGRATION_CORRIDOR_NOTE;

/** A camera spec is valid when every field is finite and inside MapLibre's own envelope. */
export function isValidChapterCamera(camera: ChapterCamera): boolean {
  const [lng, lat] = camera.center;
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90 &&
    camera.zoom >= 0 &&
    camera.zoom <= 22 &&
    camera.pitch >= 0 &&
    camera.pitch <= 85 &&
    camera.bearing >= -180 &&
    camera.bearing <= 180
  );
}
