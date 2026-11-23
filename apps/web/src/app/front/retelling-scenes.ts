/**
 * The retelling's scene model (docs/ui/DESIGN.md section 9.7): six scenes, one per word, and
 * where the scroll is among them.
 *
 * The words and their order are the existing headline model's (`hero-headline-morph.ts`); this
 * file adds what a scroll scene needs: how long each scene holds, what it shows, and the phase
 * arithmetic that turns a scroll position into "holding on scene 3" or "40% of the way from 3 to
 * 4". Nothing here is timed. A scroll position is a frame, so scrolling back plays it backward.
 *
 * Pure arithmetic over measured boxes, so it is pinned under `node:test` without a DOM or a map.
 */
import {
  HERO_HEADLINE_PHASES,
  type HeroHeadlinePhaseId,
} from '../../lib/story/hero-headline-morph';
import { tourBetween, tourDive, type TourCamera, type TourCameras } from './camera-path';

export type RetellingSceneId = HeroHeadlinePhaseId;

/** What a scene shows under its word. */
export type RetellingSceneKind = 'word' | 'record' | 'town' | 'country';

export type RetellingScene = {
  readonly id: RetellingSceneId;
  /** The scene's real heading, and its name on the rail: "His story". */
  readonly heading: string;
  /** The word that changes, set in italic as the line's one accent. Empty for History. */
  readonly prefix: string;
  readonly kind: RetellingSceneKind;
  /**
   * The scene's height in screens where scenes pin (a desktop). The scene holds still for
   * `screens - 1` and the last screen of it is the crossing into the next scene.
   */
  readonly screens: number;
};

/** Section 7.5: a pinned scene holds for at most a screen and a half. */
export const MAX_PIN_SCREENS = 1.5;
/** Section 9.7: the whole retelling is at most eight screens of scroll. */
export const MAX_TOTAL_SCREENS = 8;

const KIND: Readonly<Record<RetellingSceneId, RetellingSceneKind>> = {
  history: 'word',
  'his-story': 'record',
  'her-story': 'record',
  'your-story': 'town',
  'their-story': 'record',
  'black-story': 'country',
};

const SCREENS: Readonly<Record<RetellingSceneId, number>> = {
  history: 1.25,
  'his-story': 1.4,
  'her-story': 1.4,
  'your-story': 1.4,
  'their-story': 1.4,
  // The last scene does not hold: the contents follow it on paper.
  'black-story': 1,
};

export const RETELLING_SCENES: readonly RetellingScene[] = HERO_HEADLINE_PHASES.map((phase) => ({
  id: phase.id,
  heading: phase.subjectLabel,
  prefix: phase.prefix,
  kind: KIND[phase.id],
  screens: SCREENS[phase.id],
}));

/** The scenes that show one record each, in order. */
export type RecordSceneId = 'his-story' | 'her-story' | 'their-story';
export const RECORD_SCENE_IDS: readonly RecordSceneId[] = ['his-story', 'her-story', 'their-story'];

export function isRecordScene(id: RetellingSceneId): id is RecordSceneId {
  return (RECORD_SCENE_IDS as readonly string[]).includes(id);
}

/** One scene's section as measured on the page: its document Y and its height, in pixels. */
export type SceneBox = { readonly top: number; readonly height: number };

export type RetellingLayout = {
  readonly scenes: readonly SceneBox[];
  /** The window's height, in pixels. */
  readonly screen: number;
};

/**
 * Where the scroll is. On a hold `from === to` and `t` is 0. On a crossing `t` runs 0 (the next
 * scene's top edge is at the bottom of the window) to 1 (it has reached the top).
 */
export type RetellingPhase = {
  readonly from: number;
  readonly to: number;
  readonly t: number;
  /** The scene the reader is in: the rail marks it, and it is the nearer end of a crossing. */
  readonly current: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function retellingPhase(scrollY: number, layout: RetellingLayout): RetellingPhase {
  const { scenes, screen } = layout;
  const last = scenes.length - 1;
  if (last < 0 || screen <= 0) return { from: 0, to: 0, t: 0, current: 0 };
  let index = 0;
  for (let i = 0; i <= last; i += 1) if (scrollY >= scenes[i]!.top) index = i;
  const next = scenes[index + 1];
  if (!next) return { from: last, to: last, t: 0, current: last };
  const t = clamp01((scrollY - (next.top - screen)) / screen);
  if (t <= 0) return { from: index, to: index, t: 0, current: index };
  return { from: index, to: index + 1, t, current: t < 0.5 ? index : index + 1 };
}

/** The whole retelling's length in screens, for the eight-screen cap. */
export function retellingScreens(layout: RetellingLayout): number {
  const first = layout.scenes[0];
  const last = layout.scenes[layout.scenes.length - 1];
  if (!first || !last || layout.screen <= 0) return 0;
  return (last.top + last.height - first.top) / layout.screen;
}

/**
 * The camera for a phase. Each scene has one camera (`anchors`, in scene order): the country for
 * a word scene, a landing for a record or a town. Between two scenes the camera is the tour's
 * own: down from the country onto a record, up from one, or up until two landings fit and down
 * into the second (`camera-path.ts`).
 */
export function retellingCameraAt(
  phase: RetellingPhase,
  anchors: readonly TourCamera[],
  cameras: Pick<TourCameras, 'orbit' | 'span'>,
): TourCamera | null {
  const from = anchors[phase.from];
  const to = anchors[phase.to];
  if (!from || !to) return null;
  if (phase.from === phase.to || from === to) return from;
  const high = cameras.orbit;
  if (from === high) return tourDive(high, to, phase.t);
  if (to === high) return tourDive(high, from, 1 - phase.t);
  const peak = tourBetween(from, to, { ...cameras, opening: high, stops: [] });
  return phase.t < 0.5
    ? tourDive(peak, from, 1 - phase.t * 2)
    : tourDive(peak, to, (phase.t - 0.5) * 2);
}
