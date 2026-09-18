/**
 * User-facing copy for the Data chapter of How it works. Centralised so voice tests can read
 * every string in one place, and so the section JSX stays readable.
 *
 * Speaker: the archive describing what its figures do and do not carry. No first person here.
 * Arc: Counted (census presence) → Lived (class and conditions) → Measured gaps → How to read.
 */
import type { DestinationIconId } from '@repo/public-contracts/destinations';
import { METHODOLOGY_SOURCE_LIBRARY_HREF } from '../methodology/methodology-copy';

export const DATA_PAGE_DESCRIPTION =
  'Census counts of the Black population by decade, how class and conditions compared across race from the 1870s, and published wealth, housing, credit and justice indicators. Every figure names the series behind it and shows the numbers.';

export const DATA_INTRO = {
  kicker: 'Presence across time',
  lede: 'Black presence is countable across every census, and class and conditions are published decade by decade. Gaps in wealth, housing and justice sit after that spine, each named to its agency. Every figure states its limits and shows the numbers behind it.',
} as const;

/**
 * The chapter in order. `reading` closes: the rules for reading a figure sit after the figures.
 */
export const DATA_PAGE_SECTIONS = [
  { id: 'counted', label: 'Counted', icon: 'time' as const },
  /** `lives` is the `#lives` deep-link id; the label is the Lived act. */
  { id: 'lives', label: 'Lived', icon: 'person' as const },
  { id: 'gaps', label: 'Measured gaps', icon: 'data' as const },
  { id: 'reading', label: 'How to read', icon: 'evidence' as const },
] as const;

export type DataPageSectionId = (typeof DATA_PAGE_SECTIONS)[number]['id'];

export const DATA_SECTION_COPY = {
  counted: {
    kicker: 'Act I · U.S. Census, 1790 to 2020',
    title: 'Counted',
    lede: 'How many Black Americans each decennial census counted, what share of the country that was, and where the count moved between 2010 and 2020. The share path is the time spine the next act continues.',
  },
  lives: {
    kicker: 'Act II · Lives across the decades',
    title: 'Lived',
    lede: 'How Black, white and Hispanic Americans were spread across class, what their lives measured, and which laws were in force. That reading has its own room. This page keeps the census spine the room continues.',
  },
  gaps: {
    kicker: 'Act III · Published agency series',
    title: 'Measured gaps',
    lede: 'Wealth, housing, credit and justice indicators as agencies published them. These series do not all share the census decade grid; each keeps its own geography and period.',
  },
  reading: {
    kicker: 'Limits',
    title: 'How to read these figures',
    lede: 'Three rules hold for every figure in this chapter. The full argument for what a number is allowed to support is on Methodology.',
  },
} as const;

/** Handoff from Data to the Methodology source-library section. */
export const DATA_SOURCE_LIBRARY_HANDOFF = {
  href: METHODOLOGY_SOURCE_LIBRARY_HREF,
  label: 'Where these figures come from',
} as const;

/**
 * The reading rules. Not numbered: they hold at once, not in sequence.
 */
export const DATA_READING_RULES = [
  {
    kicker: 'Published, not derived',
    icon: 'source' as const,
    body: 'Every series here is published by the agency named beneath it. Nothing is drawn from the archive of records, and nothing is interpolated between the years an agency reported.',
  },
  {
    kicker: 'Comparison, never cause',
    icon: 'evidence' as const,
    body: 'Two bars side by side name a gap. They do not explain it. The statutes, deeds and underwriting records that explain a gap are on the place and record pages.',
  },
  {
    kicker: 'Definitions move',
    icon: 'time' as const,
    body: 'Race, ethnicity and class labels change when the agency changes them. A dashed rule or a skipped decade marks a break; it is not smoothed away.',
  },
] as const;

export const DATA_READING_LINKS: readonly {
  readonly href: string;
  readonly label: string;
  readonly icon: DestinationIconId;
}[] = [
  { href: '/lives', label: 'Lives', icon: 'person' },
  { href: '/methodology', label: 'Methodology', icon: 'methodology' },
  { href: '/stories', label: 'Stories', icon: 'stories' },
];
