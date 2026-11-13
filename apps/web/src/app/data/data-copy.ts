/**
 * User-facing copy for `/data`. Centralized so voice tests can read every string in one place,
 * and so the section JSX stays readable.
 *
 * Speaker: the archive describing what its figures do and do not carry. No first person here.
 */
import { METHODOLOGY_SOURCE_LIBRARY_HREF } from '../methodology/methodology-copy';

export const DATA_PAGE_DESCRIPTION =
  'Census counts of the Black population by decade, how class and conditions compared across race from the 1870s, and published wealth, housing, credit and justice indicators. Every figure names the series behind it and shows the numbers.';

export const DATA_INTRO = {
  lede: 'Census counts from 1790 to 2020, then wealth, housing and justice as each agency published them.',
} as const;

/** The sections in order. Each id is an anchor on the page and a deep link. */
export const DATA_PAGE_SECTIONS = [
  { id: 'counted', label: 'Population' },
  /** `lives` is the `#lives` deep-link id. */
  { id: 'lives', label: 'Lives' },
  { id: 'gaps', label: 'Measured gaps' },
  { id: 'reading', label: 'How to read' },
] as const;

export type DataPageSectionId = (typeof DATA_PAGE_SECTIONS)[number]['id'];

export const DATA_SECTION_COPY = {
  counted: {
    title: 'Population, 1790 to 2020',
    lede: 'How many Black Americans each census counted, what share of the country that was, and where the count moved between 2010 and 2020.',
  },
  lives: {
    title: 'Lives across the decades',
    lede: 'How Black, white and Hispanic Americans compared on a home, a school, a job and the count itself, decade by decade, with the rules in force.',
  },
  gaps: {
    title: 'Measured gaps',
    lede: 'Wealth, housing and justice as agencies published them. These series do not share the census decade grid; each keeps its own place and period.',
  },
  reading: {
    title: 'How to read these figures',
    lede: 'Three rules hold for every figure on this page. The full argument for what a number can support is on Methodology.',
  },
} as const;

/** The three groups inside Measured gaps. */
export const DATA_GAP_GROUPS = [
  { id: 'wealth', label: 'Wealth' },
  { id: 'housing', label: 'Housing' },
  { id: 'justice', label: 'Justice' },
] as const;

/** Short names for the contents list, keyed by figure anchor. */
export const DATA_FIGURE_NAMES: Readonly<Record<string, string>> = {
  'population-spine': 'Share of the nation',
  'population-share': 'Share, census by census',
  'population-change': 'Recent change',
  'population-count': 'Population by census',
  'population-states': 'State gains and losses',
  'wealth-ratio-sight': 'Wealth ratio',
  'wealth-gap': 'Median net worth',
  'wealth-trend': 'Net worth since 1989',
  'wealth-ratio-long-arc': 'Wealth ratio since 1860',
  'housing-ownership': 'Cook County homeownership',
  'housing-denials': 'Mortgage denials',
  'housing-ownership-long-arc': 'Homeownership since 1900',
  'housing-cost-burden': 'Housing cost burden',
  'justice-ratio-sight': 'Imprisonment ratio',
  'justice-imprisonment': 'Imprisonment rates',
  'justice-sentences': 'Federal drug sentences',
};

/** Handoff from Data to the Methodology source-library section. */
export const DATA_SOURCE_LIBRARY_HANDOFF = {
  href: METHODOLOGY_SOURCE_LIBRARY_HREF,
  label: 'Where these figures come from',
} as const;

/** The reading rules. Not numbered: they hold at once, not in sequence. */
export const DATA_READING_RULES = [
  {
    title: 'Published, not derived',
    body: 'Every series here is published by the agency named beneath it. Nothing is drawn from the archive of records, and nothing is interpolated between the years an agency reported.',
  },
  {
    title: 'Comparison, never cause',
    body: 'Two bars side by side name a gap. They do not explain it. The statutes, deeds and underwriting records that explain a gap are on the place and record pages.',
  },
  {
    title: 'Definitions move',
    body: 'Race, ethnicity and class labels change when the agency changes them. A shaded span marks where a series was measured differently, and a hatched span where nothing was published. Neither is smoothed away.',
  },
] as const;

export const DATA_READING_LINKS: readonly { readonly href: string; readonly label: string }[] = [
  { href: '/lives', label: 'Lives' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/stories', label: 'Stories' },
];
