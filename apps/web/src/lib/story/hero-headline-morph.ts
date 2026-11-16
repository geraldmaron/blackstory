/**
 * Pure timing and copy model for the Door cold-open headline subject morph:
 * History → His story → Her story → Your story → Their story → BlackStory. The last step closes
 * the gap and sets the subject in the wordmark's type (owner, 2026-11-16).
 * Letter-slot animation hints and phase resolution live here; HeroHeadlineMorph
 * renders the visual morph and trailer (" happened here.").
 */

/** Phases of the cold-open subject morph (History → … → BlackStory). */
export type HeroHeadlinePhaseId =
  'history' | 'his-story' | 'her-story' | 'your-story' | 'their-story' | 'black-story';

export type HeroHeadlinePhase = {
  readonly id: HeroHeadlinePhaseId;
  /** Subject text alone, e.g. "His story" */
  readonly subjectLabel: string;
  /** Full headline: subject + " happened here." */
  readonly accessibleLabel: string;
  /** Prefix before the "story" suffix. Empty only for History (no split yet). */
  readonly prefix: string;
  /** Whether "story" is shown as its own part (false only for History). */
  readonly storySplit: boolean;
  /** First letter of the suffix: lowercase as a word, capital inside the BlackStory name. */
  readonly storyInitial: 's' | 'S';
  /** One word in the wordmark's type (the final BlackStory only). */
  readonly wordmark: boolean;
  /** Dwell ms after transition settles before advancing. */
  readonly dwellMs: number;
  /** Transition duration into this phase (ms). */
  readonly transitionMs: number;
};

/** Spoken / accessible suffix after the animated subject. */
export const HERO_HEADLINE_TRAILER = ' happened here.';

export const HERO_HEADLINE_FINAL_PHASE_ID: HeroHeadlinePhaseId = 'black-story';

const STORY_SUFFIX = 'Story' as const;

function phase(
  id: HeroHeadlinePhaseId,
  prefix: string,
  transitionMs: number,
  dwellMs: number,
): HeroHeadlinePhase {
  const wordmark = id === HERO_HEADLINE_FINAL_PHASE_ID;
  const storySplit = prefix !== '';
  const subjectLabel = !storySplit ? 'History' : wordmark ? `${prefix}Story` : `${prefix} story`;
  return {
    id,
    subjectLabel,
    accessibleLabel: `${subjectLabel}${HERO_HEADLINE_TRAILER}`,
    prefix,
    storySplit,
    storyInitial: wordmark ? 'S' : 's',
    wordmark,
    transitionMs,
    dwellMs,
  };
}

export const HERO_HEADLINE_PHASES: readonly HeroHeadlinePhase[] = [
  phase('history', '', 0, 2800),
  /** The split (gap + s reveal) is slower than the prefix crossfades so it reads. */
  phase('his-story', 'His', 1500, 2000),
  phase('her-story', 'Her', 1100, 1400),
  phase('your-story', 'Your', 1100, 1400),
  phase('their-story', 'Their', 1100, 1400),
  phase('black-story', 'Black', 1200, Number.POSITIVE_INFINITY),
];

/** For History → His story: "His" + "tory" in the unsplit word, so UI can animate gap + s. */
export type HistorySplitHint = {
  readonly before: string;
  readonly after: string;
  readonly sharedS: true;
};

export function historySplitHint(): HistorySplitHint {
  return {
    before: 'His',
    after: 'tory',
    sharedS: true,
  };
}

/** Prefixed phases after the split share the stable word "story" (its initial is per phase). */
export function storySuffix(): typeof STORY_SUFFIX {
  return STORY_SUFFIX;
}

export function getHeroHeadlinePhaseIndexById(id: HeroHeadlinePhaseId): number {
  const index = HERO_HEADLINE_PHASES.findIndex((phase) => phase.id === id);
  if (index === -1) {
    throw new RangeError(`Unknown hero headline phase id: ${id}`);
  }
  return index;
}

export function getHeroHeadlinePhaseById(id: HeroHeadlinePhaseId): HeroHeadlinePhase {
  return HERO_HEADLINE_PHASES[getHeroHeadlinePhaseIndexById(id)]!;
}

export function getHeroHeadlinePhaseByIndex(index: number): HeroHeadlinePhase | undefined {
  if (!Number.isInteger(index) || index < 0 || index >= HERO_HEADLINE_PHASES.length) {
    return undefined;
  }
  return HERO_HEADLINE_PHASES[index];
}

function finalPhaseIndex(): number {
  return getHeroHeadlinePhaseIndexById(HERO_HEADLINE_FINAL_PHASE_ID);
}

/**
 * Play once, then hold on BlackStory indefinitely.
 * Each non-final phase occupies transitionMs + dwellMs before advancing.
 */
export function resolveHeroHeadlinePhaseIndex(elapsedMs: number, reducedMotion: boolean): number {
  if (reducedMotion) {
    return finalPhaseIndex();
  }

  const safeElapsed = Math.max(0, elapsedMs);
  const lastIndex = finalPhaseIndex();
  let accumulatedMs = 0;

  for (let index = 0; index < lastIndex; index += 1) {
    const phase = HERO_HEADLINE_PHASES[index]!;
    const phaseDurationMs = phase.transitionMs + phase.dwellMs;
    if (safeElapsed < accumulatedMs + phaseDurationMs) {
      return index;
    }
    accumulatedMs += phaseDurationMs;
  }

  return lastIndex;
}

/** Cumulative ms from sequence start until a phase begins (0 for History). */
export function heroHeadlinePhaseStartMs(index: number): number {
  const boundedIndex = Math.min(Math.max(0, index), HERO_HEADLINE_PHASES.length - 1);
  let startMs = 0;

  for (let i = 0; i < boundedIndex; i += 1) {
    const phase = HERO_HEADLINE_PHASES[i]!;
    startMs += phase.transitionMs + phase.dwellMs;
  }

  return startMs;
}
