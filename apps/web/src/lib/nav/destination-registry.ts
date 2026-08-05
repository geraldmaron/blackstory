/**
 * The destination registry: every public rendered route, once, with the facts every consumer of
 * the site's navigation needs.
 *
 * Design law: docs/ui/design-direction-v9-surfaces.md §4 (resolution map) and §4.2 (/library).
 *
 * WHY THIS EXISTS. Before it, the same set of routes was written out five times — the breadcrumb
 * table in `room-trail.ts`, `PRIMARY_NAV`/`OVERFLOW_NAV`/`FOOTER_NAV_COLUMNS` in the shared shell
 * config, the sitemap's static list, and whatever each room hand-linked in its own footer. Five
 * lists is five chances to disagree, and they did: the footer still pointed at `/history` months
 * after `/history` became a redirect, so every page on the site shipped a link into a 308.
 *
 * ONE TABLE, FIVE READERS: the breadcrumb chain (`room-trail.ts`), the /library hub, the site
 * footer, the command palette's Go section, and the sitemap. `destination-registry.test.ts`
 * fails when a route classified in `surface-classes.ts` has no entry here, which is what makes
 * "a new public route cannot be missing from the library" a test rather than a habit.
 *
 * WHAT IS NOT HERE. Endpoints — redirects, JSON, feeds, crawler files. They render no chrome and
 * are no reader's destination; `ENDPOINT_ROUTES` in `surface-classes.ts` is their list. A route
 * that appears in neither is an omission and fails the coverage test.
 */

import { CLASSIFIED_PATHS, surfaceClassFor, type SurfaceClass } from './surface-classes';

/**
 * The three card groups the library hub renders, in order, plus `find`.
 *
 * `find` is the archive's two ways into the records themselves — the map and the index. They are
 * deliberately NOT cards in the library: the library is the room for everything that is not the
 * map, so the map and the index sit in its off-ramp instead. They carry a group anyway because
 * the palette and the footer do list them.
 */
export const DESTINATION_GROUPS = ['find', 'read', 'check', 'take-part'] as const;
export type DestinationGroup = (typeof DESTINATION_GROUPS)[number];

/** The heading each group renders under in the library hub. `find` has none; see above. */
export const GROUP_HEADINGS: Readonly<Record<DestinationGroup, string | null>> = Object.freeze({
  find: null,
  read: 'Read',
  check: 'Check the archive',
  'take-part': 'Take part',
});

/** The library hub's card groups, in render order. */
export const LIBRARY_CARD_GROUPS: readonly DestinationGroup[] = ['read', 'check', 'take-part'];

export type Destination = {
  readonly path: string;
  /** Breadcrumb and nav label. Short: it appears mid-sentence in a chain. */
  readonly label: string;
  /** Parent path for the breadcrumb chain, or null for the Atlas itself. */
  readonly parent: string | null;
  /**
   * Card title, when a card wants a verb the breadcrumb should not have. "Submit" is the right
   * crumb; "Submit a lead" is the right card. Defaults to {@link Destination.label}.
   */
  readonly cardTitle?: string;
  /** Mono caps kicker on the card: what sort of thing this room is. */
  readonly kind?: string;
  /** One line. Two lines is a summary, and a card is not a summary. */
  readonly description?: string;
  /**
   * Appended to the surface-class name in the card's mono footer: `READING ROOM · PLAIN LANGUAGE`.
   * The class itself is never written here — it is read from `surface-classes.ts`, so a room that
   * is reclassified cannot keep advertising the old class on its card.
   */
  readonly modifier?: string;
  /** Absent for routes that are real destinations but not somewhere we send a reader browsing. */
  readonly group?: DestinationGroup;
  /**
   * Crawl facts, present exactly when this route belongs in the sitemap (SP-19, repo-92n2.19).
   *
   * Absent means "do not advertise": either the route is not built yet, or it is deliberately
   * kept out of the index. Both cases are commented at the entry, because an unexplained missing
   * `crawl` is indistinguishable from an oversight.
   */
  readonly crawl?: {
    readonly changeFrequency: 'daily' | 'weekly' | 'monthly';
    readonly priority: number;
  };
  /**
   * Emit `noindex, follow`. Deliberately paired with NO robots.txt Disallow: a Disallowed URL is
   * never fetched, so the crawler never reads the noindex and the URL can still be indexed from
   * inbound links alone. Blocking and de-indexing are opposite instructions.
   */
  readonly noIndex?: true;
};

/**
 * Every rendered public route. Order within a group is the order the library and the footer
 * render, so it is editorial, not alphabetical.
 *
 * The parents follow `SURF_PARENT` in `.design-mocks/blackstory-atlas-v9.html`: a reading or
 * utility room goes up to the library, a record goes up to its catalogue, and an entity goes up
 * to the Atlas — an entity is a point on the map a reader most likely arrived at from the map,
 * and /records is one way of listing entities rather than the place they live.
 */
const DESTINATIONS: readonly Destination[] = [
  /* ---- find: the two ways into the records, plus the library itself ---- */
  {
    path: '/',
    label: 'Atlas',
    parent: null,
    kind: 'MAP',
    description: 'Every record that can be placed, on the plate, in time.',
    group: 'find',
    crawl: { changeFrequency: 'daily', priority: 1 },
  },
  {
    path: '/library',
    label: 'The library',
    parent: '/',
    kind: 'HUB',
    description: 'Everything that is not the map, in one place.',
    group: 'find',
    crawl: { changeFrequency: 'monthly', priority: 0.8 },
  },
  {
    path: '/records',
    label: 'Records',
    parent: '/library',
    kind: 'INDEX',
    description: 'The whole archive as a list you can filter, page and cite.',
    group: 'find',
    crawl: { changeFrequency: 'daily', priority: 0.9 },
  },
  // `/story` is deliberately absent. Story is a MODE of the Atlas, not a room: `StoryMode` is
  // mounted inside `AtlasExperience` and reached from the Atlas itself. The route was deprecated
  // rather than built (repo-92n2.10 closed won't-do), and a registry entry for a path that never
  // renders would put it back in the palette, the footer and the library as a destination that
  // 404s. Deleting the entry is what removes it from all five readers at once.

  /* ---- read ---- */
  {
    path: '/chapters',
    label: 'Chapters',
    parent: '/library',
    kind: 'LONG FORM',
    description:
      'The archive argued rather than listed. Sourced narrative that names the records it rests on.',
    group: 'read',
    crawl: { changeFrequency: 'weekly', priority: 0.6 },
  },
  {
    path: '/law',
    label: 'Law',
    parent: '/library',
    kind: 'REFERENCE',
    description:
      'The statutes and rulings that shaped what could be built, owned, attended and voted for.',
    modifier: 'PLAIN LANGUAGE',
    group: 'read',
    crawl: { changeFrequency: 'weekly', priority: 0.7 },
  },
  {
    path: '/data',
    label: 'Data',
    parent: '/library',
    kind: 'INDICATORS',
    description:
      'National series with their sources attached, and a plain account of what each one cannot tell you.',
    modifier: 'TABULAR',
    group: 'read',
    crawl: { changeFrequency: 'weekly', priority: 0.6 },
  },
  {
    path: '/books',
    label: 'Banned books',
    parent: '/library',
    kind: 'CATALOGUE',
    description: 'Documented challenges to titles, recorded as challenges rather than as verdicts.',
    group: 'read',
    crawl: { changeFrequency: 'weekly', priority: 0.6 },
  },
  {
    path: '/memorial',
    label: 'Memorial',
    parent: '/library',
    kind: 'NAMES',
    description: 'Names, held quietly. No imagery of harm, no counts presented as a score.',
    modifier: 'STILL',
    group: 'read',
    crawl: { changeFrequency: 'monthly', priority: 0.5 },
  },

  /* ---- check the archive ---- */
  {
    path: '/methodology',
    label: 'Methodology',
    parent: '/library',
    kind: 'TRANSPARENCY',
    description:
      'How a record gets in, what the evidence grades mean, and why a point is never drawn sharper than its source.',
    modifier: 'RECEIPT',
    group: 'check',
    crawl: { changeFrequency: 'monthly', priority: 0.5 },
  },
  {
    path: '/errata',
    label: 'Errata',
    parent: '/library',
    kind: 'CORRECTIONS',
    description:
      'The mistakes the archive found and fixed, published rather than quietly overwritten.',
    modifier: 'FEED AVAILABLE',
    group: 'check',
    crawl: { changeFrequency: 'weekly', priority: 0.6 },
  },
  {
    path: '/about',
    label: 'About',
    parent: '/library',
    kind: 'FRAMING',
    description: 'What this is for, who it is for, and what it refuses to do.',
    group: 'check',
    crawl: { changeFrequency: 'monthly', priority: 0.5 },
  },

  /* ---- take part ---- */
  {
    path: '/submit',
    label: 'Submit',
    parent: '/library',
    cardTitle: 'Submit a lead',
    kind: 'CONTRIBUTE',
    description:
      'Point the archive at something it has missed. Leads are reviewed, not published on arrival.',
    modifier: 'FORM',
    group: 'take-part',
    crawl: { changeFrequency: 'monthly', priority: 0.5 },
  },
  {
    path: '/corrections',
    label: 'Corrections',
    parent: '/library',
    cardTitle: 'Request a correction',
    kind: 'CORRECT',
    description: 'Tell the archive it is wrong. You get a receipt code and a tracked outcome.',
    modifier: 'FORM · TRACKED',
    group: 'take-part',
    crawl: { changeFrequency: 'monthly', priority: 0.6 },
  },
  {
    path: '/support',
    label: 'Support',
    parent: '/library',
    kind: 'HELP',
    description: 'How to get an answer, and how long it should take.',
    group: 'take-part',
    crawl: { changeFrequency: 'monthly', priority: 0.4 },
  },

  /* ---- real destinations, but not somewhere we send a reader browsing ---- */
  {
    path: '/chapters/mosaic-credits',
    label: 'Mosaic credits',
    parent: '/chapters',
    crawl: { changeFrequency: 'monthly', priority: 0.2 },
  },
  // `/corrections/appeal` and `/corrections/abuse` are gone from this list. They were carried
  // over from the old breadcrumb table as though they were pages, and they are not: both are
  // API-only directories whose forms render inside the receipt status page. The sitemap's
  // "every crawled path has a page on disk" assertion is what surfaced it (SP-19).
  {
    path: '/privacy',
    label: 'Privacy',
    parent: '/library',
    crawl: { changeFrequency: 'monthly', priority: 0.3 },
  },
  {
    path: '/locate',
    label: 'Locate',
    parent: '/library',
    crawl: { changeFrequency: 'monthly', priority: 0.7 },
  },
  {
    // No `crawl`: a fixture gallery is not a page a reader should arrive at from a search result,
    // and its content is component names rather than archive material. `noIndex` says so in the
    // page's own head, where a crawler will actually read it. See the `noIndex` doc above for why
    // this is NOT paired with a robots.txt Disallow.
    path: '/design-system',
    label: 'Design system',
    parent: '/library',
    noIndex: true,
  },
];

const DESTINATION_BY_PATH: ReadonlyMap<string, Destination> = new Map(
  DESTINATIONS.map((destination) => [destination.path, destination]),
);

/**
 * Parents for dynamic segments, longest prefix first. A record's parent is its catalogue, which
 * is what makes "every record links back to the room that lists it" hold without any record page
 * knowing where it sits.
 */
export const DYNAMIC_PARENTS: readonly (readonly [string, string])[] = [
  ['/corrections/status/', '/corrections'],
  ['/chapters/', '/chapters'],
  ['/entity/', '/'],
  ['/books/', '/books'],
  ['/law/', '/law'],
];

/** Trailing slashes and query strings never change a route's identity. */
export function normalizeDestinationPath(pathname: string): string {
  const withoutQuery = pathname.split('?')[0]?.split('#')[0] ?? '/';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) return withoutQuery.slice(0, -1);
  return withoutQuery || '/';
}

export function destinationFor(pathname: string): Destination | undefined {
  return DESTINATION_BY_PATH.get(normalizeDestinationPath(pathname));
}

/** Every destination, in registry order. */
export function allDestinations(): readonly Destination[] {
  return DESTINATIONS;
}

/** The destinations in one group, in registry order. */
export function destinationsInGroup(group: DestinationGroup): readonly Destination[] {
  return DESTINATIONS.filter((destination) => destination.group === group);
}

/** Every destination a reader can be sent to by name — the palette's Go section. */
export function browsableDestinations(): readonly Destination[] {
  return DESTINATIONS.filter((destination) => destination.group !== undefined);
}

/** The card title: the verb form when there is one, the crumb label otherwise. */
export function cardTitleFor(destination: Destination): string {
  return destination.cardTitle ?? destination.label;
}

const SURFACE_CLASS_NAMES: Readonly<Record<SurfaceClass, string>> = Object.freeze({
  instrument: 'INSTRUMENT',
  reading: 'READING ROOM',
  record: 'RECORD',
  utility: 'UTILITY',
});

/**
 * The card's mono footer: the surface class this route actually resolves to, plus any modifier.
 *
 * Read from `surface-classes.ts` rather than stored, so a card cannot advertise `READING ROOM`
 * for a route the shell now renders as Utility.
 */
export function classLabelFor(destination: Destination): string {
  const surfaceClass = surfaceClassFor(destination.path);
  const base = surfaceClass === null ? 'ENDPOINT' : SURFACE_CLASS_NAMES[surfaceClass];
  return destination.modifier === undefined ? base : `${base} · ${destination.modifier}`;
}

/** The parent path for any route, dynamic or not. `/` has none. */
export function parentPathFor(pathname: string): string | null {
  const path = normalizeDestinationPath(pathname);
  const known = DESTINATION_BY_PATH.get(path);
  if (known) return known.parent;

  for (const [prefix, parent] of DYNAMIC_PARENTS) {
    if (path.startsWith(prefix)) return parent;
  }

  // An unrecognised path is still somewhere: it hangs off the Atlas rather than off nothing.
  return path === '/' ? null : '/';
}

/**
 * The three footer columns, derived rather than authored.
 *
 * The derivation is the whole point: the footer used to be its own list, which is how it went on
 * linking `/history` for months after that route became a redirect. Now a route joins the footer
 * by having a group, and leaves it by losing one.
 */
export type FooterColumn = {
  readonly title: string;
  readonly items: readonly { readonly href: string; readonly label: string }[];
};

export function footerColumns(): readonly FooterColumn[] {
  const column = (title: string, groups: readonly DestinationGroup[]): FooterColumn => ({
    title,
    items: groups
      .flatMap((group) => destinationsInGroup(group))
      .map((destination) => ({ href: destination.path, label: destination.label })),
  });

  return [
    column('Explore', ['find', 'read']),
    column('Trust', ['check']),
    column('Contribute', ['take-part']),
  ];
}

/**
 * The destinations the sitemap advertises, in registry order (SP-19).
 *
 * A route joins the sitemap by gaining `crawl` and leaves by losing it, so the sitemap cannot
 * drift from the site the way the old hand-kept list did — it listed `/history` twice, which put
 * a duplicate `<url>` in the XML, and went on listing it after `/history` became a redirect.
 */
export function crawlableDestinations(): readonly Destination[] {
  return DESTINATIONS.filter((destination) => destination.crawl !== undefined);
}

/** Whether this route asks to be left out of the index. Unknown routes are indexable. */
export function isNoIndexPath(pathname: string): boolean {
  return destinationFor(pathname)?.noIndex === true;
}

/**
 * Paths the coverage test requires an entry for: every classified route that is not a dynamic
 * detail page. Exported so `destination-registry.test.ts` and the sitemap read the same set.
 */
export function registryCoveragePaths(): readonly string[] {
  return CLASSIFIED_PATHS;
}
