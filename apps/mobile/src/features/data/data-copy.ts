/**
 * User-facing copy for the mobile Data v6 edition screen. Mirrors web `data-copy.ts`
 * in intent; deks are kept to a single clause here so numbers surface sooner on a
 * small screen (MOB-017 #20).
 */

export const DATA_INTRO = {
  kicker: 'Numbers',
  lede: 'The national census picture, plus published figures on wealth, housing, credit and justice. Every chart names its source.',
} as const;

export const DATA_ORIENTATION_BEATS = [
  {
    kicker: 'National first',
    body: 'The census sections show the whole country. Each indicator chart goes deeper on one published series.',
  },
  {
    kicker: 'Sources visible',
    body: 'Every figure links to its source. A chart built on sample data says so.',
  },
  {
    kicker: 'Gaps are not silence',
    body: 'Where coverage is thin, the data is incomplete. It doesn’t mean nothing happened. And two numbers side by side don’t show that one caused the other.',
  },
] as const;

export const DATA_SECTION_COPY = {
  orientation: {
    index: '01',
    kicker: 'Orientation',
    title: 'How to read these numbers',
    lede: 'The census decades give the national picture. The indicators are published series the archive reads next to its own records.',
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
    lede: 'Median family net worth from the Federal Reserve triennial survey. The figures sit side by side and don’t point to a single cause.',
  },
  housing: {
    index: '04',
    kicker: 'NHGIS · HMDA · CHAS',
    title: 'Housing, credit, and cost burden',
    lede: 'Cook County homeownership, mortgage denial rates and housing cost burden from HUD’s CHAS data.',
  },
  justice: {
    index: '05',
    kicker: 'BJS · USSC',
    title: 'Imprisonment and federal drug sentences',
    lede: 'State imprisonment rates and federal cocaine sentencing averages. They give context for the drug-policy eras and don’t prove a cause.',
  },
  themes: {
    index: '06',
    kicker: 'Phase 1',
    title: 'Curated indicator coverage',
    lede: 'These indicators sit next to the documents and policy eras they relate to, with no claim that one caused the other.',
  },
  next: {
    index: '07',
    kicker: 'Next step',
    title: 'Dig into a place',
    lede: 'Open the map for county layers. Methodology sets out how outside statistics are read next to a record.',
  },
} as const;
