/**
 * User-facing copy for the mobile Data v6 edition screen. Mirrors web `data-copy.ts`
 * in intent; deks are kept to a single clause here so numbers surface sooner on a
 * small screen (MOB-017 #20).
 */

export const DATA_INTRO = {
  kicker: 'Numbers',
  lede:
    'National Census context plus curated indicators for wealth, housing, credit, and justice. Every chart names its source.',
} as const;

export const DATA_ORIENTATION_BEATS = [
  {
    kicker: 'National first',
    body: 'Census sections show the country-wide picture; indicator charts zoom into published series.',
  },
  {
    kicker: 'Sources visible',
    body: 'Every figure links to its source. Fixture-backed charts say so.',
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
    lede: 'Census decades anchor the national story; Phase 1 indicators show curated metrics we place beside archive evidence.',
  },
  population: {
    index: '02',
    kicker: 'U.S. Census',
    title: 'Black population over time',
    lede: 'Black Americans counted by the Census each decade, 1790 to 2020.',
  },
  wealth: {
    index: '03',
    kicker: 'Survey of Consumer Finances',
    title: 'Wealth gap at a glance',
    lede: 'Median family net worth from the Federal Reserve triennial survey. Juxtaposition, not a single cause.',
  },
  housing: {
    index: '04',
    kicker: 'NHGIS · HMDA · CHAS',
    title: 'Housing, credit, and cost burden',
    lede: 'Cook County Phase 1 spine: homeownership, mortgage denial rates, and HUD CHAS cost burden.',
  },
  justice: {
    index: '05',
    kicker: 'BJS · USSC',
    title: 'Imprisonment and federal drug sentences',
    lede: 'State imprisonment rates and federal cocaine sentencing averages. Context for drug-policy eras, not proof of cause.',
  },
  themes: {
    index: '06',
    kicker: 'Phase 1',
    title: 'Curated indicator coverage',
    lede: 'These indicators sit beside artifacts and policy eras in research packets, without causal overclaim.',
  },
  next: {
    index: '07',
    kicker: 'Next step',
    title: 'Dig into a place',
    lede: 'Open the map for county layers; Methodology explains how we read outside statistics.',
  },
} as const;
