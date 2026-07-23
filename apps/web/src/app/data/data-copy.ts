/**
 * User-facing copy constants for the Data v6 edition page. Centralizes strings for
 * tests (em-dash guard) and keeps page/section JSX readable.
 */

export const DATA_PAGE_DESCRIPTION =
  'National Census population and Phase 1 indicator charts: wealth, housing, credit, and justice figures behind the BlackStory archive, each with sources you can open.';

export const DATA_INTRO = {
  kicker: 'Numbers',
  lede:
    'National Census context plus curated indicators for wealth, housing, credit, and justice. Every chart names its source. For county maps, open Explore.',
} as const;

export const DATA_ORIENTATION_BEATS = [
  {
    kicker: 'National first',
    body: 'Census sections show the country-wide picture. Indicator charts zoom into published series we also use in archival research.',
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

export const DATA_PAGE_SECTIONS = [
  { id: 'orientation', label: 'Start here' },
  { id: 'population', label: 'Population' },
  { id: 'wealth', label: 'Wealth' },
  { id: 'housing', label: 'Housing and credit' },
  { id: 'justice', label: 'Justice' },
  { id: 'themes', label: 'Coverage' },
  { id: 'next', label: 'Next step' },
] as const;

export const DATA_SECTION_COPY = {
  orientation: {
    index: '01',
    kicker: 'Orientation',
    title: 'How to read these numbers',
    lede:
      'Census decades anchor the national story. Phase 1 indicators (ACS, NHGIS, HMDA, CHAS, BJS, SCF, USSC, and more) show curated metrics we place beside archive evidence.',
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
      'Median family net worth from the Federal Reserve triennial survey: a national juxtaposition when asking how housing-credit eras relate to wealth.',
  },
  housing: {
    index: '04',
    kicker: 'NHGIS · HMDA · CHAS',
    title: 'Housing, credit, and cost burden',
    lede:
      'Cook County is our Phase 1 place spine: decennial homeownership (NHGIS), mortgage denial rates (HMDA), and HUD CHAS cost burden from the Consolidated Plan.',
  },
  justice: {
    index: '05',
    kicker: 'BJS · USSC',
    title: 'Imprisonment and federal drug sentences',
    lede:
      'State imprisonment rates (BJS) and federal cocaine sentencing averages (USSC Quick Facts): context for drug-policy eras, not proof that any single law caused a number.',
  },
  themes: {
    index: '06',
    kicker: 'Phase 1',
    title: 'Curated indicator coverage',
    lede:
      'These indicators sit beside artifacts and policy eras in research packets. Data shows the numbers; Methodology explains how we juxtapose them without causal overclaim.',
  },
  next: {
    index: '07',
    kicker: 'Next step',
    title: 'Dig into a place',
    lede:
      'Open the map for county layers and local context. Methodology explains how we read outside statistics next to archive records.',
  },
} as const;
