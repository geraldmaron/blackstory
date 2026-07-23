/**
 * User-facing copy for the mobile Data v6 edition screen. Mirrors web `data-copy.ts`.
 */

export const DATA_INTRO = {
  kicker: 'Numbers',
  lede:
    'National Census context plus curated indicators we use on Themes: wealth, housing, credit, and justice. Every chart names its source. For county maps, open Explore.',
} as const;

export const DATA_ORIENTATION_BEATS = [
  {
    kicker: 'National first',
    body: 'Census sections show the country-wide picture. Indicator charts zoom into published series we also use on Themes.',
  },
  {
    kicker: 'Sources visible',
    body: 'Every figure links to where it came from. Fixture-backed charts say so until warehouse ingest replaces them.',
  },
  {
    kicker: 'Gaps are not silence',
    body: 'Uneven coverage means the feed is incomplete, not that nothing happened. Juxtaposition is not causation.',
  },
] as const;

export const DATA_SECTION_COPY = {
  orientation: {
    index: '01',
    kicker: 'Orientation',
    title: 'How to read these numbers',
    lede:
      'Census decades anchor the national story. Phase 1 indicators show the same metrics we juxtapose on Themes.',
  },
  population: {
    index: '02',
    kicker: 'U.S. Census',
    title: 'Black population over time',
    lede:
      'How many Black Americans the Census counted each decade from 1790 to 2020: the spine for national context before place-specific indicators.',
  },
  wealth: {
    index: '03',
    kicker: 'Survey of Consumer Finances',
    title: 'Wealth gap at a glance',
    lede:
      'Median family net worth from the Federal Reserve triennial survey: a national juxtaposition used beside housing-credit eras, not proof of a single cause.',
  },
  housing: {
    index: '04',
    kicker: 'NHGIS · HMDA · CHAS',
    title: 'Housing, credit, and cost burden',
    lede:
      'Cook County is our Phase 1 place spine: decennial homeownership, mortgage denial rates, and HUD CHAS cost burden, the same metrics bound to theme-impact questions.',
  },
  justice: {
    index: '05',
    kicker: 'BJS · USSC',
    title: 'Imprisonment and federal drug sentences',
    lede:
      'State imprisonment rates and federal cocaine sentencing averages: context for drug policy eras, not proof that any single law caused a number.',
  },
  themes: {
    index: '06',
    kicker: 'Theme-impact',
    title: 'Same metrics, full stories',
    lede:
      'Themes packages these indicators beside artifacts and policy eras. Data shows the numbers; Themes shows how we juxtapose them without causal overclaim.',
  },
  next: {
    index: '07',
    kicker: 'Next step',
    title: 'Dig into a place',
    lede:
      'Open the map for county layers and local context. Methodology explains how we read outside statistics next to archive records.',
  },
} as const;
