/**
 * The web destination registry: the web app's presentation of the semantic destination catalog.
 *
 * Design law: docs/ui/design-direction-v10-product-axes.md.
 *
 * TWO LAYERS, ONE TABLE. The product semantics — stable id, canonical label, canonical path,
 * parent, family, icon, public, browsable — live once in `@repo/public-contracts/destinations`,
 * where native and admin read them too. This file adds only what the web surface itself decides:
 * card copy, the mono class modifier, the Rooms menu gloss, crawl facts, and noindex. A field
 * that only the web app can act on belongs here; a field about what a destination IS belongs in
 * the catalog.
 *
 * WHY THE SPLIT EXISTS. Before it, the same routes were written out five times — this registry,
 * the shell config's `PRIMARY_NAV`/`OVERFLOW_NAV`/`FOOTER_NAV_COLUMNS`, the sitemap's static
 * list, the mobile shell's tab table, and whatever each room hand-linked. Five lists is five
 * chances to disagree, and they did: the shell config went on emitting `/chapters` and `/library`
 * for months after both became permanent redirects, so the top nav on every page pointed into a
 * 308, and the mobile tab bar carried a `History` tab that was a renamed search screen.
 *
 * ONE TABLE, FIVE READERS: the breadcrumb chain, the /rooms hub, the site footer, the command
 * palette's Go section, and the sitemap. `destination-registry.test.ts` fails when a route
 * classified in `surface-classes.ts` has no entry here, which is what makes "a new public route
 * cannot be missing from Rooms" a test rather than a habit.
 *
 * WHAT IS NOT HERE. Endpoints — redirects, JSON, feeds, crawler files. They render no chrome and
 * are no reader's destination; `ENDPOINT_ROUTES` in `surface-classes.ts` is their list. A route
 * that appears in neither is an omission and fails the coverage test.
 */

import {
  allSemanticDestinations,
  normalizeDestinationPath,
  primaryAxes,
  type DestinationFamily,
  type SemanticDestination,
} from '@repo/public-contracts/destinations';

import { CLASSIFIED_PATHS, surfaceClassFor, type SurfaceClass } from './surface-classes';

/**
 * The card groups Rooms renders, in order, plus `find`.
 *
 * `find` is the four product axes and the door. They are deliberately NOT cards in Rooms: Rooms
 * lists the rooms. Home is the door, Explore is the map, Stories and Records are the archive's
 * own two axes. Listing an axis as an ordinary room card is how Records once read as a supporting
 * page rather than as one of the ways into the product.
 */
export const DESTINATION_GROUPS = ['find', 'read', 'check', 'take-part'] as const;
export type DestinationGroup = (typeof DESTINATION_GROUPS)[number];

/** The semantic family each rendered group draws from. One family, one group, no overlap. */
const GROUP_FAMILY: Readonly<Record<DestinationGroup, DestinationFamily>> = Object.freeze({
  find: 'axis',
  read: 'read',
  check: 'trust',
  'take-part': 'participate',
});

/** The heading each group renders under in the footer and the Rooms menu. `find` has none. */
export const GROUP_HEADINGS: Readonly<Record<DestinationGroup, string | null>> = Object.freeze({
  find: null,
  read: 'Read deeper',
  check: 'How it decides',
  'take-part': 'Add to it',
});

/**
 * Rooms hub page copy. Footer and the Rooms menu keep {@link GROUP_HEADINGS}; the hub page uses
 * these longer headings plus standfirsts so it reads as kinds of knowledge, not a settings menu.
 */
export const ROOMS_GROUP_COPY: Readonly<
  Record<DestinationGroup, { readonly heading: string | null; readonly standfirst: string | null }>
> = Object.freeze({
  find: { heading: null, standfirst: null },
  read: {
    heading: 'Rooms for reading',
    standfirst: 'Law, data, banned books, and the memorial wall.',
  },
  check: {
    heading: 'How a record gets in',
    standfirst: 'Methods, origin, plain answers, and the log of what we corrected.',
  },
  'take-part': {
    heading: 'Add what is missing',
    standfirst: 'Leads, corrections, and how to reach the archive.',
  },
});

/** Rooms' card groups, in render order. The axes are not among them. */
export const ROOMS_CARD_GROUPS: readonly DestinationGroup[] = ['read', 'check', 'take-part'];

/**
 * What the web surface adds to a semantic destination. Keyed by the catalog's stable id, so a
 * renamed route cannot silently lose its presentation.
 */
type WebPresentation = {
  /**
   * Card title, when a card wants a verb the breadcrumb should not have. "Submit" is the right
   * crumb; "Submit a lead" is the right card.
   */
  readonly cardTitle?: string;
  /**
   * What sort of thing this room is. `/rooms` cases it into `RoomCard`'s `tag`, which takes the
   * index row's third column, and the palette still reads the field as stored.
   */
  readonly kind?: string;
  /**
   * Three or four words, for the bar's Rooms menu.
   *
   * Not the same string as the catalog's description: a menu row is 195px wide and a sentence
   * wraps to four lines in it, which turned an eleven-room menu into a panel taller than the
   * surface it opened over. This is the gloss, not the summary.
   */
  readonly menuLine?: string;
  /**
   * Appended to the surface-class name in the card's mono footer: `READING ROOM · PLAIN LANGUAGE`.
   * The class itself is never written here — it is read from `surface-classes.ts`, so a room that
   * is reclassified cannot keep advertising the old class on its card.
   */
  readonly modifier?: string;
  /**
   * Crawl facts, present exactly when this route belongs in the sitemap.
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

const WEB_PRESENTATION: Readonly<Record<string, WebPresentation>> = Object.freeze({
  home: { kind: 'PLACE', crawl: { changeFrequency: 'daily', priority: 1 } },
  explore: {
    kind: 'MAP',
    menuLine: 'The map',
    crawl: { changeFrequency: 'daily', priority: 0.9 },
  },
  stories: {
    kind: 'LONG FORM',
    menuLine: 'Sourced narrative',
    crawl: { changeFrequency: 'weekly', priority: 0.8 },
  },
  records: {
    kind: 'INDEX',
    menuLine: 'The archive as a list',
    crawl: { changeFrequency: 'daily', priority: 0.9 },
  },
  rooms: { kind: 'HUB', crawl: { changeFrequency: 'monthly', priority: 0.7 } },

  law: {
    kind: 'REFERENCE',
    modifier: 'PLAIN LANGUAGE',
    menuLine: 'Statutes and rulings',
    crawl: { changeFrequency: 'weekly', priority: 0.7 },
  },
  data: {
    kind: 'INDICATORS',
    modifier: 'TABULAR',
    menuLine: 'National series',
    crawl: { changeFrequency: 'weekly', priority: 0.6 },
  },
  books: {
    kind: 'CATALOG',
    menuLine: 'Documented challenges',
    crawl: { changeFrequency: 'weekly', priority: 0.6 },
  },
  memorial: {
    kind: 'NAMES',
    modifier: 'STILL',
    menuLine: 'Names, held quietly',
    crawl: { changeFrequency: 'monthly', priority: 0.5 },
  },

  about: {
    kind: 'FRAMING',
    menuLine: 'What this refuses to do',
    crawl: { changeFrequency: 'monthly', priority: 0.5 },
  },
  faq: {
    kind: 'ANSWERS',
    menuLine: 'Plain answers',
    crawl: { changeFrequency: 'monthly', priority: 0.5 },
  },
  methodology: {
    kind: 'TRANSPARENCY',
    modifier: 'RECEIPT',
    menuLine: 'How a record gets in',
    crawl: { changeFrequency: 'monthly', priority: 0.5 },
  },
  errata: {
    kind: 'CORRECTIONS',
    modifier: 'FEED AVAILABLE',
    menuLine: 'Mistakes, published',
    crawl: { changeFrequency: 'weekly', priority: 0.6 },
  },

  submit: {
    cardTitle: 'Submit a lead',
    kind: 'CONTRIBUTE',
    modifier: 'FORM',
    menuLine: 'Send us a lead',
    crawl: { changeFrequency: 'monthly', priority: 0.5 },
  },
  corrections: {
    cardTitle: 'Request a correction',
    kind: 'CORRECT',
    modifier: 'FORM · TRACKED',
    menuLine: 'Tell us it is wrong',
    crawl: { changeFrequency: 'monthly', priority: 0.6 },
  },
  support: {
    kind: 'HELP',
    menuLine: 'Keep this running',
    crawl: { changeFrequency: 'monthly', priority: 0.4 },
  },

  // Product policy. Reachable from the footer's policy row and from More on native; not a Rooms
  // card, because a privacy notice is not a room a reader browses into.
  privacy: { crawl: { changeFrequency: 'monthly', priority: 0.3 } },

  locate: { crawl: { changeFrequency: 'monthly', priority: 0.7 } },
  'mosaic-credits': { crawl: { changeFrequency: 'monthly', priority: 0.2 } },
  // No `crawl`: a fixture gallery is not a page a reader should arrive at from a search result,
  // and its content is component names rather than archive material. `noIndex` says so in the
  // page's own head, where a crawler will actually read it. See the `noIndex` doc above for why
  // this is NOT paired with a robots.txt Disallow.
  'design-system': { noIndex: true },
});

export type Destination = SemanticDestination &
  WebPresentation & { readonly group?: DestinationGroup };

const FAMILY_GROUP = new Map<DestinationFamily, DestinationGroup>(
  (Object.keys(GROUP_FAMILY) as DestinationGroup[]).map((group) => [GROUP_FAMILY[group], group]),
);

/**
 * Every rendered public route, in the catalog's product order.
 *
 * A destination's `group` is derived from its family, so a route joins Rooms, the footer and the
 * palette by being classified once rather than by being remembered in four places. A family with
 * no rendered group (`policy`, `record`, `utility`) yields no group, which is what keeps a
 * privacy notice and a fixture gallery off the room cards.
 */
const DESTINATIONS: readonly Destination[] = allSemanticDestinations().map((semantic) => {
  const presentation = WEB_PRESENTATION[semantic.id] ?? {};
  const group = semantic.browsable ? FAMILY_GROUP.get(semantic.family) : undefined;
  return group === undefined
    ? { ...semantic, ...presentation }
    : { ...semantic, ...presentation, group };
});

/** The four product axes as web destinations, in order. Primary navigation renders exactly this. */
export function primaryNavDestinations(): readonly Destination[] {
  const byPath = new Map(DESTINATIONS.map((destination) => [destination.path, destination]));
  return primaryAxes().map((axis) => {
    const found = byPath.get(axis.path);
    if (!found) throw new Error(`primaryNavDestinations: ${axis.path} is not in the registry`);
    return found;
  });
}

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
  ['/stories/', '/stories'],
  // A record's catalogue is Records, on both the entity and the place address. It used to be the
  // door, on the theory that a reader most likely arrived from the map — but a breadcrumb states
  // where a page SITS, not how the reader got there, and the way back to a map selection is
  // return state, not hierarchy. With Records a top-level axis rather than a room inside Rooms,
  // the catalogue that lists a record is the honest parent.
  ['/place/', '/records'],
  ['/entity/', '/records'],
  ['/books/', '/books'],
  ['/law/', '/law'],
];

/**
 * Trailing slashes and query strings never change a route's identity.
 *
 * Re-exported from the semantic catalog rather than reimplemented: web and native have to agree
 * on what counts as the same destination, or a deep link normalizes one way on the phone and
 * another on the site.
 */
export { normalizeDestinationPath };

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

/**
 * The one room list: the same three groups as `/about`, Rooms, and the editorial footer columns.
 * Explore, Records, and Rooms itself stay off this list; Find chrome lists them separately.
 */
export function browsableDestinations(): readonly Destination[] {
  return ROOMS_CARD_GROUPS.flatMap((group) => destinationsInGroup(group));
}

/** The card title: the verb form when there is one, the crumb label otherwise. */
export function cardTitleFor(destination: Destination): string {
  return destination.cardTitle ?? destination.label;
}

const SURFACE_CLASS_NAMES: Readonly<Record<SurfaceClass, string>> = Object.freeze({
  door: 'DOOR',
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

  // An unrecognized path is still somewhere: it hangs off Explore rather than off nothing.
  return path === '/' ? null : '/';
}

/**
 * The footer columns, derived rather than authored.
 *
 * Find (Home / Explore / Rooms / Records) leads; the three editorial groups follow. A route
 * joins the footer by having a group, and leaves it by losing one — so `/history` cannot linger
 * after it becomes a redirect.
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

  /* Find stays in the footer and the command bar; Rooms / browsableDestinations stay editorial. */
  return [
    {
      title: 'Find',
      items: destinationsInGroup('find').map((destination) => ({
        href: destination.path,
        label: destination.label,
      })),
    },
    column(GROUP_HEADINGS.read ?? 'Where to begin', ['read']),
    column(GROUP_HEADINGS.check ?? 'How it decides', ['check']),
    column(GROUP_HEADINGS['take-part'] ?? 'Add to it', ['take-part']),
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
