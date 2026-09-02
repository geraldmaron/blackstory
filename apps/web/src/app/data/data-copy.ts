/**
 * User-facing copy constants for the Data v6 edition page. Centralizes strings for
 * tests (em-dash guard) and keeps page/section JSX readable.
 *
 * Speaker: the archive describing what its charts do and do not carry. No first person here.
 */

export const DATA_PAGE_DESCRIPTION =
  'Census counts of the Black population by decade, 1790 to 2020, alongside published wealth, housing, credit and justice indicators. Every chart names the series behind it and links out to it.';

export const DATA_INTRO = {
  kicker: 'Numbers',
  lede: 'Census counts by decade, and published indicator series for wealth, housing, credit and justice. Every chart names its source and shows the numbers behind it.',
} as const;

export const DATA_ORIENTATION_BEATS = [
  {
    kicker: 'Start national',
    body: 'The census sections are the country-wide picture. The indicator charts under them narrow to one survey, one county, or one reporting series.',
  },
  {
    kicker: 'Every figure links back',
    body: 'A chart built from published reference figures says so on its own card.',
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
    lede: 'Census decades anchor the national picture. The indicator charts (ACS, NHGIS, HMDA, CHAS, BJS, SCF, USSC and others) are published series that sit beside the archive rather than being drawn from it. Where a series has thin years, the reporting is thin, which is not the same as nothing having happened, and two charts placed side by side are a comparison, never a cause.',
  },
  population: {
    index: '02',
    kicker: 'U.S. Census',
    title: 'Black population over time',
    lede: 'How many Black Americans the census counted in each decade from 1790 to 2020, and where that count moved, state by state, between 2010 and 2020.',
  },
  wealth: {
    index: '03',
    kicker: 'Survey of Consumer Finances',
    title: 'Wealth gap at a glance',
    lede: "Median family net worth from the Federal Reserve's triennial Survey of Consumer Finances, one survey year at a time.",
  },
  housing: {
    index: '04',
    kicker: 'NHGIS · HMDA · CHAS',
    title: 'Housing, credit, and cost burden',
    lede: 'Cook County is the first county covered here: decennial homeownership (NHGIS), mortgage denial rates (HMDA), and cost burden from the HUD CHAS tables behind the Consolidated Plan.',
  },
  justice: {
    index: '05',
    kicker: 'BJS · USSC',
    title: 'Imprisonment and federal drug sentences',
    lede: 'State imprisonment rates (BJS) and average federal cocaine sentence lengths (USSC Quick Facts), as each agency published them.',
  },
  themes: {
    index: '06',
    kicker: 'Coverage',
    title: 'Curated indicator coverage',
    lede: 'These indicators sit beside artifacts and policy eras in the research behind record pages. What a number is allowed to support, and where the line runs between comparison and cause, is set out on Methodology.',
  },
  next: {
    index: '07',
    kicker: 'Next step',
    title: 'Dig into a place',
    lede: 'A national series can tell you the size of a gap. The statutes, deeds and underwriting records that explain one are on the place and record pages.',
  },
} as const;
