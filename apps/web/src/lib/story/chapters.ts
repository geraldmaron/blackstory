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

/**
 * Where a chapter sits in the argument, independent of which chapter is drawn to fill it.
 *
 * The running order varies between visits (see `pick-story-chapters.ts`) so a reader who comes back
 * learns something new rather than re-reading one script. What must not vary is the shape of the
 * argument: the archive is introduced, then shown to be uneven, then opened up on a single pin,
 * then given context, then run across time, then handed over. Selection happens *within* a stage
 * and the stages always run in this order, which is what keeps a varying story coherent instead of
 * a shuffled deck.
 */
export type StoryStage = 'opening' | 'shape' | 'evidence' | 'context' | 'time' | 'closing';

/** The fixed narrative order. A varying story is still told in this sequence. */
export const STORY_STAGE_ORDER: readonly StoryStage[] = [
  'opening',
  'shape',
  'evidence',
  'context',
  'time',
  'closing',
];

export type StoryChapter = {
  /**
   * Position in the running order this visit, 0-based, and 0 is always the cold open. Assigned by
   * `pickStoryChapters`, not authored: a chapter's position depends on what else was drawn.
   */
  readonly index: number;
  readonly id: string;
  /** Which beat of the argument this chapter fills. */
  readonly stage: StoryStage;
  readonly camera: ChapterCamera;
  /** Centred card, no index badge. The cold open and the outro. */
  readonly centred: boolean;
  /** Radial spotlight over the chapter's own centre, as a percentage radius. */
  readonly spotlightRadiusPercent?: number;
  /** Draw the migration corridors. */
  readonly routes?: boolean;
  /** Run the decade sweep while this chapter is in view. */
  readonly sweep?: boolean;
  /**
   * Draw a record from the release and pin it, rather than naming one here. Chapter 2's argument is
   * that *every* pin opens into evidence, and a fixed record turns that into an anecdote about one
   * famous building. The pick is made by `pick-story-record.ts`, which excludes violence-adjacent
   * records: this chapter pushes in close and dwells, and dwelling on harm is what §4.3 refuses.
   */
  readonly focusRandomRecord?: true;
  /**
   * Show one of the twenty cited facts in `story-facts.ts` instead of fixed prose. A reader who
   * returns should not meet the same sentence; every entry carries its own source, which is what
   * makes rotating them safe.
   */
  readonly rotatingFact?: true;
};

/**
 * `threshold: 0.42` against the story scroll container. Low enough that a chapter fires before it
 * is fully centred (the camera needs a head start), high enough that a chapter clipping the
 * viewport edge does not steal the camera from the one the reader is reading.
 */
export const CHAPTER_INTERSECTION_THRESHOLD = 0.42;

/**
 * The authored pool. This is not the running order: `pickStoryChapters` draws from it per visit and
 * assigns the real `index`. The `index` values here are the pool's own default ordering, kept so a
 * caller that wants the canonical full sequence still gets a sensible one.
 */
export const STORY_CHAPTERS: readonly StoryChapter[] = [
  {
    index: 0,
    id: 'cold-open',
    stage: 'opening',
    camera: { center: [-96.5, 38.6], zoom: 3.35, pitch: 0, bearing: 0 },
    centred: true,
  },
  {
    index: 1,
    id: 'thickest',
    stage: 'shape',
    camera: { center: [-90.05, 32.3], zoom: 5.1, pitch: 34, bearing: -14 },
    centred: false,
    spotlightRadiusPercent: 20,
  },
  {
    index: 2,
    id: 'one-record',
    stage: 'evidence',
    // The fallback framing, used only when the release yields no eligible record. The chapter
    // normally flies to whatever `pickStoryRecord` returned, at whatever zoom the dignity gate allows.
    camera: { center: [-86.81, 33.52], zoom: 13.4, pitch: 56, bearing: 24 },
    centred: false,
    focusRandomRecord: true,
  },
  {
    index: 3,
    id: 'migration',
    stage: 'context',
    camera: { center: [-88.2, 37.6], zoom: 4.05, pitch: 42, bearing: 0 },
    centred: false,
    routes: true,
    rotatingFact: true,
  },
  {
    /*
     * A second context slot, drawn only on some visits and always carrying a *different* fact from
     * the one above. This is the main lever on "not the same set of points each time": the number
     * of chapters and which cited facts appear both change between visits, while the surrounding
     * argument does not. No corridors here — the corridor overlay belongs to the chapter whose
     * honesty line explains it.
     */
    index: 4,
    id: 'second-context',
    stage: 'context',
    camera: { center: [-89.4, 36.2], zoom: 4.2, pitch: 30, bearing: 0 },
    centred: false,
    rotatingFact: true,
  },
  {
    index: 5,
    id: 'four-centuries',
    stage: 'time',
    camera: { center: [-95.2, 39.2], zoom: 3.5, pitch: 0, bearing: 0 },
    centred: false,
    sweep: true,
  },
  {
    index: 6,
    id: 'your-turn',
    stage: 'closing',
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
