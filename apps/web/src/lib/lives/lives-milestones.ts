import {
  LIVES_LENSES,
  RACE_ETHNICITY_DEFINITION_LABELS,
  livesAcsVintage,
  type LivesAreaBundle,
  type LivesCell,
  type LivesConditionBundle,
  type LivesConditionKey,
  type LivesDecade,
  type LivesDecadeBundle,
  type LivesLens,
  type LivesRule,
  type LivesSourceRef,
  type LivesWorldBeat,
  type LivesWorldDomain,
} from '@repo/domain/statistics/lives';

export const LIVES_MILESTONE_KEYS = [
  'home',
  'place',
  'school',
  'education',
  'work',
  'count',
] as const;

export type LivesMilestoneKey = (typeof LIVES_MILESTONE_KEYS)[number];

export type LivesMilestone = {
  readonly key: LivesMilestoneKey;
  readonly title: string;
  readonly shortLabel: string;
  readonly question: string;
  readonly condition: LivesConditionKey;
  readonly domains: readonly LivesWorldDomain[];
  readonly lawDomains: readonly string[];
};

export const LIVES_MILESTONES: readonly LivesMilestone[] = [
  {
    key: 'home',
    title: 'Keeping a home',
    shortLabel: 'Home',
    question: 'Who could keep a home, and what did the count call a household?',
    condition: 'homeownership',
    domains: ['housing', 'affordance', 'testimony'],
    lawDomains: ['housing', 'credit'],
  },
  {
    key: 'place',
    title: 'Leaving, and staying',
    shortLabel: 'Place',
    question: 'Where did people build lives as the country became more urban?',
    condition: 'urban',
    domains: ['world', 'housing', 'testimony'],
    lawDomains: ['housing', 'public_accommodation', 'work'],
  },
  {
    key: 'school',
    title: 'Starting school',
    shortLabel: 'School',
    question: 'Which children were counted as attending school?',
    condition: 'school_attendance',
    domains: ['schooling', 'family', 'testimony'],
    lawDomains: ['schooling', 'family'],
  },
  {
    key: 'education',
    title: 'Finishing school',
    shortLabel: 'Education',
    question: 'How did finishing high school change across adult lives?',
    condition: 'high_school',
    domains: ['schooling', 'work', 'testimony'],
    lawDomains: ['schooling'],
  },
  {
    key: 'work',
    title: 'Finding work',
    shortLabel: 'Work',
    question: 'Who was counted as looking for work, and under which rules?',
    condition: 'unemployed',
    domains: ['work', 'income', 'testimony'],
    lawDomains: ['work', 'income_support'],
  },
  {
    key: 'count',
    title: 'Being counted',
    shortLabel: 'Count',
    question: 'Who could the census see, and how did its categories change?',
    condition: 'population_share',
    domains: ['count', 'political', 'testimony'],
    lawDomains: ['voting', 'justice'],
  },
] as const;

export const DEFAULT_LIVES_MILESTONE = LIVES_MILESTONES[0]!;

export type LivesEra = {
  readonly id: string;
  readonly start: LivesDecade;
  readonly end: LivesDecade;
  readonly label: string;
};

/**
 * `start` and `end` name DECADES, so an era runs through the last year of its end decade: the
 * first era covers 1870 through 1899. Labels say "1870s–1890s" for that reason. A label of
 * "1870–1890" put Plessy v. Ferguson (1896) under a heading whose years excluded it.
 */
export const LIVES_ERAS: readonly LivesEra[] = [
  { id: '1870-1890', start: 1870, end: 1890, label: '1870s–1890s' },
  { id: '1900-1930', start: 1900, end: 1930, label: '1900s–1930s' },
  { id: '1940-1960', start: 1940, end: 1960, label: '1940s–1960s' },
  { id: '1970-1980', start: 1970, end: 1980, label: '1970s–1980s' },
  { id: '1990-2000', start: 1990, end: 2000, label: '1990s–2000s' },
  { id: '2010-2020', start: 2010, end: 2020, label: '2010s–2020s' },
] as const;

export type LivesMilestoneValue = {
  readonly lens: LivesLens;
  readonly cell: LivesCell;
};

export type LivesMilestoneContext =
  | { readonly kind: 'beat'; readonly beat: LivesWorldBeat }
  | {
      readonly kind: 'count-note';
      readonly heading: string;
      readonly body: string;
      readonly citations: readonly LivesSourceRef[];
    };

/** The published comparison an era shows: one decade, one condition, each group's cell. */
export type LivesMilestoneFigure = {
  readonly decade: LivesDecadeBundle;
  readonly condition: LivesConditionBundle;
  readonly values: readonly LivesMilestoneValue[];
  readonly sources: readonly LivesSourceRef[];
};

/**
 * One era of one life question. `Narrative` is whatever the caller attaches as the era's authored
 * prose (the web app attaches a hydrated article); this module only carries it.
 *
 * An era normally has a figure. A NARRATIVE-LED era has none: the census published no comparison
 * for it, or none is transcribed yet. It renders only when it has authored prose plus at least one
 * account or rule, so history no longer disappears wherever the statistics do, and an era with
 * nothing to say still does not render (the blank-panel failure of 2026-09-18 cannot recur).
 */
export type LivesMilestonePanel<Narrative = unknown> = {
  readonly era: LivesEra;
  readonly figure: LivesMilestoneFigure | null;
  /** Set only when `figure` is null: why this era has no comparison, in plain words. */
  readonly figureAbsence: string | null;
  readonly context: LivesMilestoneContext | null;
  readonly rules: readonly LivesRule[];
  /** First-person accounts: beats that carry a speaker and that speaker's own quoted words. */
  readonly accounts: readonly LivesWorldBeat[];
  readonly narrative: Narrative | null;
};

function isPublished(cell: LivesCell): boolean {
  return (
    (cell.state === 'published' || cell.state === 'wide_margin') &&
    cell.estimate !== undefined &&
    cell.definitionLabel !== undefined &&
    (cell.sources?.length ?? 0) > 0
  );
}

function conditionFor(
  decade: LivesDecadeBundle,
  key: LivesConditionKey,
): LivesConditionBundle | undefined {
  return decade.conditions.find((condition) => condition.key === key);
}

function comparableValues(condition: LivesConditionBundle): readonly LivesMilestoneValue[] {
  if (!isPublished(condition.cells.black)) return [];
  // A broad historical proxy is not a Black-specific comparison. Keep it in the appendix.
  if (condition.cells.black.definitionLabel === RACE_ETHNICITY_DEFINITION_LABELS.nonwhite)
    return [];
  const values = LIVES_LENSES.flatMap((lens) => {
    const cell = condition.cells[lens];
    return isPublished(cell) ? [{ lens, cell }] : [];
  });
  return values.length >= 2 ? values : [];
}

function uniqueSources(values: readonly LivesMilestoneValue[]): readonly LivesSourceRef[] {
  const sources = new Map<string, LivesSourceRef>();
  for (const value of values) {
    for (const source of value.cell.sources ?? [])
      sources.set(`${source.url}|${source.label}`, source);
  }
  return [...sources.values()];
}

function matchingContext(
  decade: LivesDecadeBundle,
  milestone: LivesMilestone,
): LivesMilestoneContext | null {
  const beat = decade.worldBeats.find(
    (candidate) =>
      milestone.domains.includes(candidate.domain) &&
      candidate.domain !== 'testimony' &&
      !candidate.quote &&
      (candidate.appliesTo.includes('all') || candidate.appliesTo.includes('black')),
  );
  if (beat) return { kind: 'beat', beat };

  const note = decade.countNotes.find(
    (candidate) => candidate.appliesTo.includes('all') || candidate.appliesTo.includes('black'),
  );
  return note
    ? {
        kind: 'count-note',
        heading: note.heading,
        body: note.body,
        citations: note.citations,
      }
    : null;
}

/** The current condition adapters use ACS only for these modern measures. */
export function livesMilestonePeriod(figure: LivesMilestoneFigure): string {
  const acs = ['homeownership', 'high_school', 'unemployed'].includes(figure.condition.key)
    ? livesAcsVintage(figure.decade.decade)
    : null;
  return acs
    ? `${acs.replace('-', '–')} · ACS five-year estimate`
    : `${figure.decade.decade} · Census snapshot`;
}

function rulesBeginningInEra(
  bundle: LivesAreaBundle,
  era: LivesEra,
  milestone: LivesMilestone,
): readonly LivesRule[] {
  const rules = new Map<string, LivesRule>();
  for (const decade of bundle.decades) {
    for (const rule of decade.rulesInForce) {
      if (rule.inForceFromYear < era.start || rule.inForceFromYear > era.end + 9) continue;
      if (!rule.lifeDomains.some((domain) => milestone.lawDomains.includes(domain))) continue;
      rules.set(rule.id, rule);
    }
  }
  // Every matching rule, in date order. A cap of "the first two by date" hid the National Housing
  // Act of 1934 behind two 1910s-20s cases and the Fair Housing Act of 1968 behind two 1940s
  // entries; the surface decides how many to show open, never this selection.
  return [...rules.values()].sort(
    (a, b) => a.inForceFromYear - b.inForceFromYear || a.name.localeCompare(b.name),
  );
}

/** The decades a question's visible panels actually span, for the page's own header. */
export function livesMilestoneSpanLabel(panels: readonly LivesMilestonePanel[]): string | null {
  const first = panels[0];
  const last = panels[panels.length - 1];
  if (!first || !last) return null;
  return `${first.era.start}s to ${last.era.end}s`;
}

export function parseLivesMilestone(value: string | readonly string[] | undefined): LivesMilestone {
  const key = typeof value === 'string' ? value : value?.[0];
  return LIVES_MILESTONES.find((milestone) => milestone.key === key) ?? DEFAULT_LIVES_MILESTONE;
}

function eraDecades(bundle: LivesAreaBundle, era: LivesEra): readonly LivesDecadeBundle[] {
  return bundle.decades
    .filter((decade) => decade.decade >= era.start && decade.decade <= era.end)
    .sort((a, b) => b.decade - a.decade);
}

function figureForEra(
  bundle: LivesAreaBundle,
  era: LivesEra,
  milestone: LivesMilestone,
): LivesMilestoneFigure | null {
  for (const decade of eraDecades(bundle, era)) {
    const condition = conditionFor(decade, milestone.condition);
    if (!condition) continue;
    const values = comparableValues(condition);
    if (values.length < 2) continue;
    return { decade, condition, values, sources: uniqueSources(values) };
  }
  return null;
}

/**
 * Accounts are beats that carry a speaker AND that speaker's quoted words, filed under one of the
 * question's topical domains. The catch-all `testimony` domain is excluded on purpose: it would
 * put every account under every question.
 */
function accountsInEra(
  bundle: LivesAreaBundle,
  era: LivesEra,
  milestone: LivesMilestone,
): readonly LivesWorldBeat[] {
  const seen = new Set<string>();
  return [...eraDecades(bundle, era)]
    .reverse()
    .flatMap((decade) => decade.worldBeats)
    .filter((beat) => {
      if (!beat.quote || !beat.speaker) return false;
      if (beat.domain === 'testimony' || !milestone.domains.includes(beat.domain)) return false;
      if (!(beat.appliesTo.includes('all') || beat.appliesTo.includes('black'))) return false;
      if (seen.has(beat.id)) return false;
      seen.add(beat.id);
      return true;
    });
}

/**
 * Why an era has no comparison. The cell's own reason is used when the data carries one, because
 * "the census never asked" and "this archive has not transcribed it" are different silences and
 * must never be worded alike. Without a reason, the line claims only what is true by construction:
 * that no comparison is on record here.
 */
function figureAbsenceForEra(
  bundle: LivesAreaBundle,
  era: LivesEra,
  milestone: LivesMilestone,
): string {
  for (const decade of eraDecades(bundle, era)) {
    const cell = conditionFor(decade, milestone.condition)?.cells.black;
    if (!cell) continue;
    if (cell.state === 'not_measured' && cell.reason) return cell.reason;
    if (cell.state === 'pending') {
      return 'A comparison for these decades was published, and it hasn’t been transcribed here yet.';
    }
    if (cell.state === 'suppressed' && cell.reason) return cell.reason;
  }
  return 'No published national comparison is on record here for these decades.';
}

export function buildLivesMilestonePanels<Narrative = unknown>(
  bundle: LivesAreaBundle,
  milestone: LivesMilestone,
  narratives: ReadonlyMap<string, Narrative> = new Map(),
): readonly LivesMilestonePanel<Narrative>[] {
  return LIVES_ERAS.flatMap((era): LivesMilestonePanel<Narrative>[] => {
    const figure = figureForEra(bundle, era, milestone);
    const rules = rulesBeginningInEra(bundle, era, milestone);
    const accounts = accountsInEra(bundle, era, milestone);
    const narrative = narratives.get(era.id) ?? null;

    if (figure) {
      return [
        {
          era,
          figure,
          figureAbsence: null,
          context: matchingContext(figure.decade, milestone),
          rules,
          accounts,
          narrative,
        },
      ];
    }
    if (narrative && (accounts.length > 0 || rules.length > 0)) {
      return [
        {
          era,
          figure: null,
          figureAbsence: figureAbsenceForEra(bundle, era, milestone),
          context: null,
          rules,
          accounts,
          narrative,
        },
      ];
    }
    return [];
  });
}
