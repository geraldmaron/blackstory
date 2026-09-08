/**
 * The native content route registry: which sections exist, what they show, where they navigate.
 *
 * It lives with the content machinery rather than with Stories because it routes into BOTH — the
 * narrative surface and the supporting reference pages read the same catalog through it. Filing
 * it under Stories would have made the supporting pages depend on the narrative feature, which is
 * the shape of the boundary this split existed to remove.
 *
 * It used to hold four "Learn" rows (History, Topics, Myths, Methodology) and five "More" rows
 * (About, Quick facts, Legal, Privacy, Errata), which is nine destinations for what is really
 * two things: one narrative publication surface, and a handful of reference pages a reader opens
 * once. History was an era facet, Topics was a tag, Myths was a format, Quick facts duplicated
 * the Records tab, and "Legal" meant product policy while `/law` meant historical statute.
 *
 * What is left: Stories is one section, and each supporting page is addressed by its own route.
 */
import type { CatalogSectionId } from './content-catalog';

export interface SectionRow {
  /** The URL segment. Story sections live under `/stories`; supporting pages are top-level. */
  readonly routeId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly catalogSection: CatalogSectionId;
  /**
   * When set, this row has exactly one page and navigates straight to it rather than through an
   * intermediate "pick a slug" index screen.
   */
  readonly directSlug?: string;
}

/** The narrative surface. One row, because Stories is one surface. */
export const STORY_SECTIONS: readonly SectionRow[] = [
  {
    routeId: 'stories',
    title: 'Stories',
    subtitle: 'Chapters, entries and corrections, pinned to place and evidence',
    catalogSection: 'stories',
  },
];

/**
 * Reference pages reached from More. Each is one page, so each navigates straight to it.
 *
 * Privacy and Terms are product policy and say so. They are never filed under Law, which is
 * historical statute and ruling — the old ambiguous "Legal" row is exactly how a reader looking
 * for a privacy notice could land in the civil-rights statute reference.
 */
export const SUPPORTING_SECTIONS: readonly SectionRow[] = [
  {
    routeId: 'about',
    title: 'About',
    subtitle: 'What this is for, and what it refuses to do',
    catalogSection: 'about',
    directSlug: 'about',
  },
  {
    routeId: 'methodology',
    title: 'Methodology',
    subtitle: 'How a record gets in, and what a grade means',
    catalogSection: 'methodology',
    directSlug: 'overview',
  },
  {
    routeId: 'errata',
    title: 'Errata',
    subtitle: 'Mistakes the archive found and published',
    catalogSection: 'errata',
    directSlug: 'errata',
  },
  {
    routeId: 'privacy',
    title: 'Privacy',
    subtitle: 'What this app collects, and what it does not',
    catalogSection: 'privacy',
    directSlug: 'privacy',
  },
  {
    routeId: 'terms',
    title: 'Terms',
    subtitle: 'The terms this app is offered under',
    catalogSection: 'terms',
    directSlug: 'terms',
  },
];

export const ALL_SECTIONS: readonly SectionRow[] = [...STORY_SECTIONS, ...SUPPORTING_SECTIONS];

export function findSectionRow(routeId: string): SectionRow | undefined {
  return ALL_SECTIONS.find((row) => row.routeId === routeId);
}

/** True when the section is reference material reached from More rather than a Story. */
export function isSupportingSection(routeId: string): boolean {
  return SUPPORTING_SECTIONS.some((row) => row.routeId === routeId);
}

/**
 * Tab root to land on when a content screen has no history (deep link or cold start).
 * Supporting pages return to More; Stories returns to the Stories tab.
 */
export function sectionBackFallback(routeId: string): '/more' | '/stories' {
  return isSupportingSection(routeId) ? '/more' : '/stories';
}

/**
 * Where a legacy `/learn/...` address lands now.
 *
 * The old sections were `history`, `topics` and `myths` (narrative, now Stories), `methodology`,
 * `about`, `errata` and `privacy` (reference, now their own routes), `legal` (ambiguous: it meant
 * product policy, so it lands on Privacy and never on `/law`), and `facts` (a bounded digest that
 * duplicated the Records tab, so it lands on Records).
 *
 * A slug under a narrative section keeps its slug: `/learn/myths/dunbar-founded-1916` resolves to
 * `/stories/dunbar-founded-1916`, not to the index. A published link that loses the piece a
 * reader asked for is worse than a dead one, because it looks like the archive dropped it.
 */
export type LegacyLearnTarget =
  | '/stories'
  | `/stories/${string}`
  | '/methodology'
  | '/about'
  | '/errata'
  | '/privacy'
  | '/records';

const LEGACY_LEARN_SECTIONS: Readonly<Record<string, LegacyLearnTarget>> = Object.freeze({
  history: '/stories',
  topics: '/stories',
  myths: '/stories',
  stories: '/stories',
  methodology: '/methodology',
  about: '/about',
  errata: '/errata',
  privacy: '/privacy',
  legal: '/privacy',
  facts: '/records',
});

const NARRATIVE_LEGACY_SECTIONS = new Set(['history', 'topics', 'myths', 'stories']);

export function legacyLearnTarget(segments: readonly string[]): LegacyLearnTarget {
  const [section, slug] = segments;
  if (!section) return '/stories';
  const target = LEGACY_LEARN_SECTIONS[section];
  if (!target) return '/stories';
  if (slug && NARRATIVE_LEGACY_SECTIONS.has(section)) return `/stories/${slug}`;
  return target;
}

/** True when a section renders as narrative (serif body, calm chrome) rather than reference. */
export function isNarrativeSection(section: string): boolean {
  return STORY_SECTIONS.some((row) => row.catalogSection === section || row.routeId === section);
}
