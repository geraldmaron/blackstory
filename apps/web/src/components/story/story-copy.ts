/**
 * Story copy, all six chapters.
 *
 * Voice rules, binding (design-direction-v9-atlas.md §6, brand.md):
 *   - no em dashes anywhere
 *   - sentence case everywhere; no kickers above headings
 *   - one emphasis word per heading, carried in `accent` (set plain, never in copper)
 *   - two sentences of prose at most: the map carries the chapter, the card names it
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
  /** Heading with `{accent}` marking where the italic serif word goes. */
  readonly heading: string;
  /** The single italic accent word. Exactly one per heading. */
  readonly accent: string;
  readonly prose: string;
  readonly facts?: readonly { readonly value: string; readonly label: string }[];
  /**
   * The citation under the card, only when the chapter makes a claim from outside the archive.
   * A real source line, never a note about the interface.
   */
  readonly cite?: string;
};

export const STORY_COPY: readonly ChapterCopy[] = [
  {
    id: 'cold-open',
    heading: 'History happened {accent}.',
    accent: 'here',
    prose:
      'This archive connects records to places where the evidence supports a location. This is a short pass over what is in it. The map moves with the story.',
  },
  {
    id: 'thickest',
    heading: 'The archive is not {accent} spread.',
    accent: 'evenly',
    prose:
      'The map shows what survived, what was digitized and what has been researched so far. A cluster can mean concentrated cataloging, and a blank area does not mean nothing happened there.',
  },
  {
    id: 'one-record',
    heading: 'Every pin opens into {accent}.',
    accent: 'evidence',
    prose:
      'The A.G. Gaston Motel in Birmingham, Alabama. A.G. Gaston, a Black businessman in Birmingham, built it in 1954, and in 1963 it became the headquarters of the Birmingham campaign. Room 30 was the war room. It is one pin, and you can read its citations before you decide to trust it.',
    facts: [
      { value: 'Birmingham', label: 'Alabama' },
      { value: '1954', label: 'built' },
      { value: '1963', label: 'campaign headquarters' },
    ],
    cite: 'A.G. Gaston Motel, National Historic Landmark, National Park Service.',
  },
  {
    id: 'migration',
    // Above any drawn fact about the migration and the record it left, so it names neither.
    heading: 'The record {accent} the people.',
    accent: 'follows',
    prose:
      'Between 1910 and 1970 about six million people left the South. The corridors were not random: rail lines and kin networks decided who landed in Chicago and who landed in Los Angeles. Records cluster at both ends of every line, which is why a Mississippi surname turns up in a Milwaukee school register.',
    facts: [{ value: '1910 to 1970', label: 'the period' }],
    cite: `Six million is the standard figure for the Great Migration, 1910 to 1970 (Isabel Wilkerson, The Warmth of Other Suns, 2010). ${CORRIDOR_HONESTY_LINE}`,
  },
  {
    /*
     * The second context chapter. Its body is always a drawn fact carrying its own citation, so
     * the heading stays deliberately general: they have to sit correctly above any of
     * the twenty entries, which rules out naming a place or a figure here. The prose below
     * is the fallback for a draw that failed to resolve, and it claims nothing the rest
     * of the page does not already establish.
     */
    id: 'second-context',
    heading: 'The record keeps {accent}.',
    accent: 'talking',
    prose:
      'The same archive answers more than one question. Where people went, what they built when they arrived, and which of it somebody thought to write down.',
  },
  {
    id: 'four-centuries',
    heading: 'Watch the record {accent}.',
    accent: 'fill',
    prose:
      'The map clears, then takes the archive back one decade at a time. It fills unevenly, thin in the colonial years and thickest around the civil rights record, where documenting and organizing ran together.',
  },
  {
    id: 'your-turn',
    heading: 'Start where you {accent}.',
    accent: 'stand',
    prose: 'Every record links to its sources, and where the archive is thin, it says so.',
  },
];

export function copyFor(id: string): ChapterCopy | undefined {
  return STORY_COPY.find((chapter) => chapter.id === id);
}

/** Splits a heading on its `{accent}` slot so the surface can italicize exactly one word. */
export function headingParts(copy: ChapterCopy): {
  readonly before: string;
  readonly accent: string;
  readonly after: string;
} {
  const [before = '', after = ''] = copy.heading.split('{accent}');
  return { before, accent: copy.accent, after };
}
