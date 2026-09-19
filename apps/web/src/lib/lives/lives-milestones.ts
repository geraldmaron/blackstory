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

export const LIVES_ERAS: readonly LivesEra[] = [
  { id: '1870-1890', start: 1870, end: 1890, label: '1870–1890' },
  { id: '1900-1930', start: 1900, end: 1930, label: '1900–1930' },
  { id: '1940-1960', start: 1940, end: 1960, label: '1940–1960' },
  { id: '1970-1980', start: 1970, end: 1980, label: '1970–1980' },
  { id: '1990-2000', start: 1990, end: 2000, label: '1990–2000' },
  { id: '2010-2020', start: 2010, end: 2020, label: '2010–2020' },
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

export type LivesMilestonePanel = {
  readonly era: LivesEra;
  readonly decade: LivesDecadeBundle;
  readonly condition: LivesConditionBundle;
  readonly values: readonly LivesMilestoneValue[];
  readonly sources: readonly LivesSourceRef[];
  readonly context: LivesMilestoneContext | null;
  readonly rules: readonly LivesRule[];
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
export function livesMilestonePeriod(panel: LivesMilestonePanel): string {
  const acs = ['homeownership', 'high_school', 'unemployed'].includes(panel.condition.key)
    ? livesAcsVintage(panel.decade.decade)
    : null;
  return acs
    ? `${acs.replace('-', '–')} · ACS five-year estimate`
    : `${panel.decade.decade} · Census snapshot`;
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
  return [...rules.values()]
    .sort((a, b) => a.inForceFromYear - b.inForceFromYear || a.name.localeCompare(b.name))
    .slice(0, 2);
}

export function parseLivesMilestone(value: string | readonly string[] | undefined): LivesMilestone {
  const key = typeof value === 'string' ? value : value?.[0];
  return LIVES_MILESTONES.find((milestone) => milestone.key === key) ?? DEFAULT_LIVES_MILESTONE;
}

export function buildLivesMilestonePanels(
  bundle: LivesAreaBundle,
  milestone: LivesMilestone,
): readonly LivesMilestonePanel[] {
  return LIVES_ERAS.flatMap((era) => {
    const candidates = bundle.decades
      .filter((decade) => decade.decade >= era.start && decade.decade <= era.end)
      .sort((a, b) => b.decade - a.decade);

    for (const decade of candidates) {
      const condition = conditionFor(decade, milestone.condition);
      if (!condition) continue;
      const values = comparableValues(condition);
      if (values.length < 2) continue;
      return [
        {
          era,
          decade,
          condition,
          values,
          sources: uniqueSources(values),
          context: matchingContext(decade, milestone),
          rules: rulesBeginningInEra(bundle, era, milestone),
        },
      ];
    }
    return [];
  });
}
