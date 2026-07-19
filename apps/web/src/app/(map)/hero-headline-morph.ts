/**
 * Pure timing and copy model for the home hero headline subject morph:
 * History → His Story → Her Story → Their Story → Your Story → Black Story.
 * Letter-slot animation hints and phase resolution live here; HeroStage renders
 * the visual morph and trailer (" happened here.").
 */

/** Phases of the hero subject morph (History → … → Black Story). */
export type HeroHeadlinePhaseId =
  'history' | 'his-story' | 'her-story' | 'their-story' | 'your-story' | 'black-story';

export type HeroHeadlinePhase = {
  readonly id: HeroHeadlinePhaseId;
  /** Accessible / aria text for the subject alone, e.g. "His Story" */
  readonly subjectLabel: string;
  /** Full accessible headline: subject + " happened here." */
  readonly accessibleLabel: string;
  /** Prefix before the stable "Story" suffix. Empty only for History (no Story split yet). */
  readonly prefix: string;
  /** Whether Story is shown as a separate word (false only for History). */
  readonly storySplit: boolean;
  /** Dwell ms after transition settles before advancing. */
  readonly dwellMs: number;
  /** Transition duration into this phase (ms). */
  readonly transitionMs: number;
};

/** Spoken / accessible suffix after the animated subject. */
export const HERO_HEADLINE_TRAILER = ' happened here.';

export const HERO_HEADLINE_FINAL_PHASE_ID: HeroHeadlinePhaseId = 'black-story';

const STORY_SUFFIX = 'Story' as const;

function buildAccessibleLabel(subjectLabel: string): string {
  return `${subjectLabel}${HERO_HEADLINE_TRAILER}`;
}

export const HERO_HEADLINE_PHASES: readonly HeroHeadlinePhase[] = [
  {
    id: 'history',
    subjectLabel: 'History',
    accessibleLabel: buildAccessibleLabel('History'),
    prefix: '',
    storySplit: false,
    transitionMs: 0,
    dwellMs: 2800,
  },
  {
    id: 'his-story',
    subjectLabel: 'His Story',
    accessibleLabel: buildAccessibleLabel('His Story'),
    prefix: 'His',
    storySplit: true,
    /** Gap + capital-S reveal — slower than prefix crossfades so the split reads. */
    transitionMs: 1500,
    dwellMs: 2000,
  },
  {
    id: 'her-story',
    subjectLabel: 'Her Story',
    accessibleLabel: buildAccessibleLabel('Her Story'),
    prefix: 'Her',
    storySplit: true,
    transitionMs: 1100,
    dwellMs: 1400,
  },
  {
    id: 'their-story',
    subjectLabel: 'Their Story',
    accessibleLabel: buildAccessibleLabel('Their Story'),
    prefix: 'Their',
    storySplit: true,
    transitionMs: 1100,
    dwellMs: 1400,
  },
  {
    id: 'your-story',
    subjectLabel: 'Your Story',
    accessibleLabel: buildAccessibleLabel('Your Story'),
    prefix: 'Your',
    storySplit: true,
    transitionMs: 1100,
    dwellMs: 1400,
  },
  {
    id: 'black-story',
    subjectLabel: 'Black Story',
    accessibleLabel: buildAccessibleLabel('Black Story'),
    prefix: 'Black',
    storySplit: true,
    transitionMs: 1200,
    dwellMs: Number.POSITIVE_INFINITY,
  },
] as const;

/** For History→His Story: describe the special split so UI can animate gap + S case morph. */
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

/** Prefixed phases after the split share the stable word "Story". */
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
 * Total loop: play once through all phases, then hold on Black Story indefinitely.
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
