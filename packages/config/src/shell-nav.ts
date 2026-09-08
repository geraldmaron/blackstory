/**
 * Shell-bar navigation, derived from the semantic destination catalog.
 *
 * This file is an ADAPTER, not a registry. The product's destinations, their canonical paths and
 * their families live once in `@repo/public-contracts/destinations`; everything here is the
 * shell bar's own composition of that table — which axes are always visible, what the overflow
 * disclosure holds, and how the footer columns group.
 *
 * WHY IT IS NO LONGER A LIST. It used to be one, hand-kept, and it drifted: it went on emitting
 * `/chapters` and `/library` for months after both became permanent redirects, so the top nav on
 * every page of the site pointed into a 308. A hand-kept list cannot notice that a route it names
 * has stopped existing. A derived one cannot name a route that does not exist.
 *
 * Admin reads `PRIMARY_NAV` for its cross-app chrome; the public web app derives its own nav from
 * the same catalog through `apps/web/src/lib/nav/destination-registry.ts`, which adds the web-only
 * presentation (crawl facts, card copy, surface class) the catalog deliberately refuses to hold.
 */

import {
  allSemanticDestinations,
  primaryAxes,
  semanticDestinationsInFamily,
  type DestinationFamily,
  type SemanticDestination,
} from '@repo/public-contracts/destinations';

import { trimTrailingSlashes } from './trim.js';

export type ShellNavItem = {
  readonly href: string;
  readonly label: string;
};

const toItem = (destination: SemanticDestination): ShellNavItem => ({
  href: destination.path,
  label: destination.label,
});

/**
 * Always-visible top-level nav: the four product axes, in product order.
 *
 * Home is deliberately absent. The brand lockup already links home on every surface, and a fifth
 * primary item is how the last generation of this menu grew an About tab that competed with the
 * archive for the reader's attention.
 */
export const PRIMARY_NAV: readonly ShellNavItem[] = primaryAxes().map(toItem);

const family = (name: DestinationFamily): readonly ShellNavItem[] =>
  semanticDestinationsInFamily(name)
    .filter((destination) => destination.browsable)
    .map(toItem);

/**
 * Overflow routes: desktop "More" disclosure + mobile drawer. The supporting rooms, grouped the
 * way Rooms and the footer group them — read deeper, then trust, then take part.
 */
export const OVERFLOW_NAV: readonly ShellNavItem[] = [
  ...family('read'),
  ...family('trust'),
  ...family('participate'),
];

export type FooterNavColumn = {
  readonly title: string;
  readonly items: readonly ShellNavItem[];
};

/**
 * Footer columns for the admin shell, which has no access to the web app's registry.
 *
 * The public web footer derives its own columns from `destination-registry.ts`, so a route joins
 * the footer by existing rather than by being remembered. Both derive from the same catalog, and
 * `shell-nav.test.ts` fails if either can name a destination the catalog does not hold.
 */
export const FOOTER_NAV_COLUMNS: readonly FooterNavColumn[] = [
  { title: 'Find', items: PRIMARY_NAV },
  { title: 'Read deeper', items: family('read') },
  { title: 'How it decides', items: family('trust') },
  { title: 'Add to it', items: family('participate') },
];

/** Every public destination as a flat list, for consumers that want the whole surface. */
export const ALL_SHELL_DESTINATIONS: readonly ShellNavItem[] = allSemanticDestinations()
  .filter((destination) => destination.isPublic)
  .map(toItem);

export function isShellNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  try {
    if (/^https?:\/\//i.test(href)) {
      const url = new URL(href);
      return isShellNavActive(pathname, url.pathname);
    }
  } catch {
    // fall through
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Prefix relative shell hrefs with a public origin for cross-app admin chrome. */
export function absolutizeShellNav(
  items: readonly ShellNavItem[],
  origin: string | null,
): readonly ShellNavItem[] {
  if (!origin) return items;
  const base = trimTrailingSlashes(origin);
  return items.map((item) => ({
    ...item,
    href: item.href.startsWith('http')
      ? item.href
      : `${base}${item.href.startsWith('/') ? item.href : `/${item.href}`}`,
  }));
}
