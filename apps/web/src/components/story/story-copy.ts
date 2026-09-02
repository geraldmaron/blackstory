/**
 * Story copy, all six chapters.
 *
 * Voice rules, binding (design-direction-v9-atlas.md §6, brand.md):
 *   - no em dashes anywhere
 *   - sentence case in body copy; mono uppercase for slugs only
 *   - exactly one italic accent word per heading, carried in `accent`
 *   - people are named with their role and their place
 *   - presence is framed as presence, never as deficit
 *
 * **Every factual claim carries a source.** The counts come from the active release, which is why
 * they are described as counts from this release rather than as counts of what happened. The one
 * claim that comes from outside the archive is chapter 3's migration figure, and it carries its
 * citation in `cite`. A claim that cannot be sourced is cut, not softened.
 */

import { CORRIDOR_HONESTY_LINE } from '../../lib/story/chapters';

export type ChapterCopy = {
  readonly id: string;
  /** Mono uppercase slug above the heading. Absent on the cold open. */
  readonly kicker?: string;
  /** Heading with `{accent}` marking where the italic serif word goes. */
  readonly heading: string;
  /** The single italic accent word. Exactly one per heading. */
  readonly accent: string;
  readonly prose: string;
  readonly facts?: readonly { readonly value: string; readonly label: string }[];
  /** The line under the card. Sourcing, honesty, or precision. Never decoration. */
  readonly cite: string;
};

/** The cold open headline, split into words for the kinetic stagger. */
export const COLD_OPEN_WORDS = ['History', 'happened', 'here.'] as const;

export const STORY_COPY: readonly ChapterCopy[] = [
  {
    id: 'cold-open',
    heading: 'History happened {accent}.',
    accent: 'here',
    prose:
      'Every record in this archive is tied to a place you can stand in. This is a short pass over what is in it. The map moves with the story.',
    cite: 'Counts on this page are counts of the active release, not claims about everything that happened.',
  },
  {
    id: 'thickest',
    kicker: 'Where the record is thickest',
    heading: 'The archive is not {accent} spread.',
    accent: 'evenly',
    prose:
      'Coverage follows surviving evidence. The Mississippi Delta, the Carolina low country and the District carry the deepest documentation in this release because that is where the paper survived: church minutes, school registers, deeds and National Register nominations.',
    facts: [
      { value: 'Delta', label: 'deepest coverage' },
      { value: 'District of Columbia', label: 'most records per square mile' },
      { value: 'South Carolina', label: 'deep low country record' },
    ],
    cite: 'Coverage depth is a statement about which sources survived, not about where history happened.',
  },
  {
    id: 'one-record',
    kicker: 'One record, up close',
    heading: 'Every pin opens into {accent}.',
    accent: 'evidence',
    prose:
      'The A.G. Gaston Motel in Birmingham, Alabama. A.G. Gaston, a Black businessman in Birmingham, built it in 1954, and in 1963 it became the headquarters of the Birmingham campaign. Room 30 was the war room. It is one pin, and you can read its citations before you decide to trust it.',
    facts: [
      { value: 'Birmingham', label: 'Alabama' },
      { value: '1954', label: 'built' },
      { value: '1963', label: 'campaign headquarters' },
    ],
    cite: 'A.G. Gaston Motel, National Historic Landmark, National Park Service. Shown at the precision its sources support.',
  },
  {
    id: 'migration',
    kicker: 'The Great Migration',
    heading: 'Six million people, {accent} as they moved.',
    accent: 'drawn',
    prose:
      'Between 1910 and 1970 about six million people left the South. The corridors were not random: rail lines and kin networks decided who landed in Chicago and who landed in Los Angeles. Records cluster at both ends of every line, which is why a Mississippi surname turns up in a Milwaukee school register.',
    facts: [
      { value: '1910 to 1970', label: 'the period' },
      { value: '7', label: 'corridors drawn' },
    ],
    cite: `Six million is the standard figure for the Great Migration, 1910 to 1970 (Isabel Wilkerson, The Warmth of Other Suns, 2010). ${CORRIDOR_HONESTY_LINE}`,
  },
  {
    /*
     * The second context chapter. Its body is always a drawn fact carrying its own citation, so
     * the heading and kicker stay deliberately general: they have to sit correctly above any of
     * the twenty entries, which rules out naming a place or a figure here. The prose and cite
     * below are the fallback for a draw that failed to resolve, and they claim nothing the rest
     * of the page does not already establish.
     */
    id: 'second-context',
    kicker: 'And one more thing',
    heading: 'The record keeps {accent}.',
    accent: 'talking',
    prose:
      'The same archive answers more than one question. Where people went, what they built when they arrived, and which of it somebody thought to write down.',
    cite: 'Every figure on this card carries its own source, named on the card itself.',
  },
  {
    id: 'four-centuries',
    kicker: 'Four centuries in ten seconds',
    heading: 'Watch the record {accent}.',
    accent: 'fill',
    prose:
      'Scrub from the 1630s to the 2020s and the map fills unevenly. Thin colonial entries in the tidewater. A thickening through Reconstruction. A hard cluster around the twentieth century civil rights record, where documenting and organising ran together.',
    facts: [
      { value: '1630s', label: 'earliest in this release' },
      { value: '2020s', label: 'latest in this release' },
      { value: '40', label: 'decades' },
    ],
    cite: 'Status is shown as-of each decade from published status history. Never present-day status backfilled.',
  },
  {
    id: 'your-turn',
    kicker: 'Your turn',
    heading: 'Start where you {accent}.',
    accent: 'stand',
    prose:
      'Everything you just watched is a control you can hold. Open Explore, drop into your own state, and follow the evidence.',
    cite: 'Every record links to its sources. Where the archive is thin, it says so.',
  },
];

export function copyFor(id: string): ChapterCopy | undefined {
  return STORY_COPY.find((chapter) => chapter.id === id);
}

/** Splits a heading on its `{accent}` slot so the surface can italicise exactly one word. */
export function headingParts(copy: ChapterCopy): {
  readonly before: string;
  readonly accent: string;
  readonly after: string;
} {
  const [before = '', after = ''] = copy.heading.split('{accent}');
  return { before, accent: copy.accent, after };
}
