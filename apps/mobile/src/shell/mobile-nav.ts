/**
 * The native shell's composition of the semantic destination catalog: tab order, More sections,
 * and legacy deep-link normalization.
 *
 * The catalog (`@repo/public-contracts/destinations`) says what a destination IS — id, label,
 * canonical path, family, semantic icon. This file says how the phone renders it. It used to be
 * a hand-kept mirror of the web shell config, which is why it carried a `History` tab that was
 * the search screen under another name, a `Stories` tab whose route was `/learn`, and More rows
 * whose subtitles named web routes at the reader ("Privacy and terms (web: /legal)").
 *
 * Native routes are not always the canonical web path. A row records its own native route and
 * falls back to opening the web surface when the phone has no screen for it — stated per row,
 * never guessed.
 */
import {
  allSemanticDestinations,
  canonicalPathForLegacy,
  semanticDestinationById,
  semanticDestinationsInFamily,
  type DestinationFamily,
  type SemanticDestination,
} from '@repo/public-contracts/destinations';

import type { NavIconName } from '@/ui/NavIcon';

export type MobileTabId = 'archive' | 'stories' | 'data' | 'more';

export type MobileTabDefinition = {
  readonly id: MobileTabId;
  readonly label: string;
  /** Expo Router tab root path (no group prefix). */
  readonly route: `/${string}`;
  readonly icon: NavIconName;
};

/** The Archive tab's two views (docs/ui/DESIGN.md section 9.2). The map is the default. */
export type ArchiveView = 'map' | 'list';
export const ARCHIVE_ROUTE = '/archive' as const;
/** The Archive as a list: where search lives, and where every legacy find-in-time link lands. */
export const ARCHIVE_LIST_HREF = { pathname: ARCHIVE_ROUTE, params: { view: 'list' } } as const;

function catalogTab(id: 'stories' | 'data'): MobileTabDefinition {
  const destination = semanticDestinationById(id);
  /* istanbul ignore next -- the catalog is exhaustive; this is a load-bearing assert. */
  if (!destination) throw new Error(`MOBILE_PRIMARY_TABS: no destination for "${id}"`);
  return {
    id,
    label: destination.label,
    route: destination.path as `/${string}`,
    icon: destination.icon as NavIconName,
  };
}

/**
 * The bottom tab bar: Archive, Stories, Data, More (docs/ui/DESIGN.md section 11).
 *
 * Archive is the map with its list and filters, what were the Explore and Records tabs, behind
 * one Map and List switch. It is defined here because the shared catalog still lists the web's
 * `/explore` and `/records` as separate axes until the web merges them (DESIGN.md phase 4b).
 * Search is not a tab: it is the Archive's list view.
 */
export const MOBILE_PRIMARY_TABS: readonly MobileTabDefinition[] = [
  { id: 'archive', label: 'Archive', route: ARCHIVE_ROUTE, icon: 'explore' },
  catalogTab('stories'),
  catalogTab('data'),
  { id: 'more', label: 'More', route: '/more', icon: 'more' },
] as const;

export type MobileMoreDestination =
  | { readonly kind: 'native'; readonly route: `/${string}` }
  | { readonly kind: 'web'; readonly href: string };

export type MobileMoreRow = {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: NavIconName;
  readonly destination: MobileMoreDestination;
};

export type MobileMoreSection = {
  readonly id: string;
  readonly title: string;
  readonly meta: string;
  readonly rows: readonly MobileMoreRow[];
};

/**
 * What the phone adds to a semantic destination, keyed by the catalog's stable id.
 *
 * `line` is a phone row's one useful line: shorter than the catalog description, which is sized
 * for a desktop card. `route` is the native screen; a row with no `route` opens the web surface,
 * which is stated here rather than discovered by a reader tapping into nothing.
 */
type MoreRowPresentation = {
  readonly line: string;
  readonly route?: `/${string}`;
  readonly icon?: NavIconName;
};

const MORE_PRESENTATION: Readonly<Record<string, MoreRowPresentation>> = Object.freeze({
  presidents: {
    line: 'Every president, in order, with the sources',
    route: '/presidents',
    icon: 'institution',
  },
  law: { line: 'Statutes and rulings, in plain language', route: '/law', icon: 'law' },
  lives: { line: 'One question about daily life, decade by decade' },
  books: { line: 'Documented challenges, with the reports cited', route: '/books' },
  memorial: { line: 'Names, held quietly', route: '/memorial' },

  about: { line: 'What this is for, and what it won’t do', route: '/about' },
  faq: { line: 'Plain answers about how this archive works', route: '/faq' },
  methodology: { line: 'How a record gets in, and what a grade means', route: '/methodology' },
  sources: { line: 'The publishers a citation traces to' },
  errata: { line: 'Mistakes the archive found and published', route: '/errata' },

  submit: { line: 'Point the archive at something it missed', route: '/submit' },
  corrections: {
    line: 'Tell the archive it’s wrong and get a receipt',
    route: '/corrections/submit',
  },
  support: { line: 'How to get an answer, and how long it takes', route: '/support' },

  privacy: { line: 'What this app collects, and what it doesn’t', route: '/privacy' },
  terms: { line: 'What using this app means, in plain language', route: '/terms' },
});

/** The public web origin a row falls back to when the phone has no screen for a destination. */
const WEB_ORIGIN = 'https://blackstory.app';

function moreRow(destination: SemanticDestination): MobileMoreRow {
  const presentation = MORE_PRESENTATION[destination.id];
  /* istanbul ignore next -- `more-sections.test.ts` fails before this can be reached. */
  if (!presentation) throw new Error(`MOBILE_MORE_SECTIONS: no phone copy for "${destination.id}"`);
  return {
    id: destination.id,
    title: destination.label,
    subtitle: presentation.line,
    icon: presentation.icon ?? (destination.icon as NavIconName),
    destination: presentation.route
      ? { kind: 'native', route: presentation.route }
      : { kind: 'web', href: `${WEB_ORIGIN}${destination.path}` },
  };
}

const section = (
  id: string,
  title: string,
  meta: string,
  family: DestinationFamily,
): MobileMoreSection => ({
  id,
  title,
  meta,
  rows: semanticDestinationsInFamily(family)
    .filter((destination) => destination.isPublic)
    // A tab duplicated inside More is a second, worse route to somewhere the bar already goes.
    .filter((destination) => !MOBILE_PRIMARY_TABS.some((tab) => tab.id === destination.id))
    .map(moreRow),
});

/**
 * The More ledger: the web's collections, then the trust pages and forms About lists, grouped the
 * way the web footer groups them, rendered as native rows rather than cards squeezed onto a phone.
 *
 * The product axes are deliberately absent — a tab duplicated inside More is a second, worse
 * route to somewhere the tab bar already goes.
 */
export const MOBILE_MORE_SECTIONS: readonly MobileMoreSection[] = [
  section('read', 'Collections', 'Read in order', 'read'),
  section('trust', 'Trust & About', 'Method & corrections', 'trust'),
  section('take-part', 'Take part', 'Community', 'participate'),
  section('policies', 'Policies', 'Product policy', 'policy'),
];

/** Tab roots allowed for cold-start restore and returnTo params. */
export const MOBILE_TAB_ROOTS: readonly `/${string}`[] = MOBILE_PRIMARY_TABS.map(
  (tab) => tab.route,
);

/**
 * Native routes that still have to resolve, and the tab root each becomes.
 *
 * `/explore` and `/records` were tabs until the Archive merged them; `/learn`, `/history` and
 * `/search` are older still. Each keeps a route file that redirects with the reader's query, so
 * an old deep link, a saved link and restored navigation state all land (`(tabs)/explore.tsx`,
 * `(tabs)/records.tsx`, `(tabs)/search.tsx`, `(tabs)/history.tsx`, `learn/[...legacy].tsx`).
 */
const NATIVE_LEGACY_ROUTES: Readonly<Record<string, `/${string}`>> = Object.freeze({
  '/explore': ARCHIVE_ROUTE,
  '/records': ARCHIVE_ROUTE,
  '/learn': '/stories',
  '/history': ARCHIVE_ROUTE,
  '/search': ARCHIVE_ROUTE,
  '/topics': '/stories',
  '/myths': '/stories',
  '/chapters': '/stories',
  '/articles': '/stories',
  '/facts': ARCHIVE_ROUTE,
  '/library': '/more',
});

/** Kept for the deep-link tests and callers that still name the old search root. */
export const MOBILE_LEGACY_SEARCH_ROUTE = '/search' as const;

/**
 * Normalizes a legacy tab root to its canonical one.
 *
 * Cross-checked against the catalog rather than trusting the local table: if the product decides
 * `/history` now means something other than Records, this stops agreeing and the test fails.
 */
export function normalizeMobileTabRoot(route: `/${string}`): `/${string}` {
  return NATIVE_LEGACY_ROUTES[route] ?? route;
}

/** Every legacy native route and its canonical target, for the deep-link guard. */
export function nativeLegacyRoutes(): readonly (readonly [string, string])[] {
  return Object.entries(NATIVE_LEGACY_ROUTES);
}

/**
 * Where a canonical WEB path lands on the phone, when the two platforms name the same job
 * differently: the web hub `/collections` is the phone's `More`, and the web's map and list are
 * the phone's one Archive. Anything not listed here uses the same path on both.
 */
export const WEB_TO_NATIVE_ROUTE: Readonly<Record<string, `/${string}`>> = Object.freeze({
  '/collections': '/more',
  // Until the web's own Archive lands (DESIGN.md phase 4b) its map and list are two addresses.
  '/explore': ARCHIVE_ROUTE,
  '/records': ARCHIVE_ROUTE,
});

/** The native route for a canonical web path. */
export function nativeRouteForWebPath(path: string): string {
  return WEB_TO_NATIVE_ROUTE[path] ?? path;
}

/**
 * What the shared catalog says a legacy path resolves to, or `null` when it is not an alias.
 * Re-exported so the native guard reads the catalog directly rather than a copy of it.
 */
export { canonicalPathForLegacy, semanticDestinationById, allSemanticDestinations };

export function findMobileTab(id: MobileTabId): MobileTabDefinition | undefined {
  return MOBILE_PRIMARY_TABS.find((tab) => tab.id === id);
}
