/**
 * User-facing copy for `/data`. Centralised so the voice tests (no em dashes, no internal
 * vocabulary) can read every string in one place, and so the section JSX stays readable.
 *
 * Speaker: the archive describing what its figures do and do not carry. No first person here.
 * Every sentence about a number is a sentence about a published series, never about the
 * archive's own catalogue: the counted breakdown of records is not a figure on this page.
 */

export const DATA_PAGE_DESCRIPTION =
  'Census counts of the Black population by decade, 1790 to 2020, alongside published wealth, housing, credit and justice indicators. Every figure names the series behind it and shows the numbers.';

export const DATA_INTRO = {
  kicker: 'Reference ledger',
  lede: 'Census counts by decade, and published indicator series for wealth, housing, credit and justice. Every figure names its source, states its limits, and shows the numbers behind it.',
} as const;

/**
 * The page in order. `reading` closes the page: the rules for reading a figure sit after the
 * figures, where a reader who has just met one has a reason to want them.
 */
export const DATA_PAGE_SECTIONS = [
  { id: 'population', label: 'Population' },
  { id: 'wealth', label: 'Wealth' },
  { id: 'housing', label: 'Housing and credit' },
  { id: 'justice', label: 'Justice' },
  { id: 'reading', label: 'How to read' },
] as const;

export type DataPageSectionId = (typeof DATA_PAGE_SECTIONS)[number]['id'];

export const DATA_SECTION_COPY = {
  population: {
    kicker: 'U.S. Census, 1790 to 2020',
    title: 'Black population over time',
    lede: 'How many Black Americans each decennial census counted, what share of the country that was, and where the count moved between 2010 and 2020.',
  },
  wealth: {
    kicker: 'Federal Reserve, Survey of Consumer Finances',
    title: 'The wealth gap',
    lede: 'Median family net worth, Black and White, in the latest survey wave and across every wave since 1989. A gap measured at a point in time, in 2022 dollars.',
  },
  housing: {
    kicker: 'NHGIS, HMDA and HUD CHAS',
    title: 'Housing, credit and cost burden',
    lede: 'Cook County, Illinois is the first county covered: decennial homeownership by householder race, mortgage denial rates, and the share of households paying more than they can afford.',
  },
  justice: {
    kicker: 'Bureau of Justice Statistics and U.S. Sentencing Commission',
    title: 'Imprisonment and federal drug sentences',
    lede: 'State imprisonment rates by race, and average federal sentence lengths for crack and powder cocaine, as each agency published them.',
  },
  reading: {
    kicker: 'Limits',
    title: 'How to read these figures',
    lede: 'Three rules hold for every figure on this page. The full argument for what a number is allowed to support is on Methodology.',
  },
} as const;

/**
 * The reading rules. Not numbered: they hold at once, not in sequence.
 */
export const DATA_READING_RULES = [
  {
    kicker: 'Published, not derived',
    body: 'Every series here is published by the agency named beneath it. Nothing is drawn from the archive of records, and nothing is interpolated between the years an agency reported.',
  },
  {
    kicker: 'Comparison, never cause',
    body: 'Two bars side by side name a gap. They do not explain it. The statutes, deeds and underwriting records that explain a gap are on the place and record pages.',
  },
  {
    kicker: 'Definitions move',
    body: 'Race categories on the census changed in 2000, when a person could mark more than one race. A count before that line and a count after it are not the same measurement, and the figures mark the line rather than smoothing across it.',
  },
] as const;

/** Where the reading rules send a reader who wants the full argument. */
export const DATA_READING_LINKS = [
  { href: '/methodology', label: 'Methodology' },
  { href: '/stories', label: 'Stories that use these numbers' },
] as const;
