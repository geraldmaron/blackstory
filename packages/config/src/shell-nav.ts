/**
 * Shared public-shell navigation IA (primary + overflow + footer columns).
 * Used by web and admin so both surfaces render the same theme-aware shell bar.
 */

import { trimTrailingSlashes } from './trim.js';

export type ShellNavItem = {
  readonly href: string;
  readonly label: string;
};

/**
 * Always-visible top-level nav — sans caps; active route gets a copper underline.
 * Journey order: act (Explore) → read (Chapters) → go deep (Library) → meta (About last).
 *
 * Explore is the map instrument on `/explore`. `/` is the Door (immersive pin plate); the brand
 * lockup already links home, so the first nav item opens the map readers expect when they
 * press "Explore".
 */
export const PRIMARY_NAV: readonly ShellNavItem[] = [
  { href: '/explore', label: 'Explore' },
  { href: '/chapters', label: 'Chapters' },
  // Was `/history`, which became a permanent redirect to `/records` — so the top nav on every
  // page of the site pointed into a 308. The v9 replacement is the library hub (SP-21): it is
  // the room every reading and utility surface parents through, and it names `/records` first.
  { href: '/library', label: 'Library' },
  { href: '/about', label: 'About' },
] as const;

/**
 * Overflow routes: desktop "More" disclosure + mobile drawer.
 * Grouped to mirror the footer IA: archive reference (Data → Memorial), then trust
 * (Methodology → Errata), then contribute (Submit) — keep additions inside their group.
 */
export const OVERFLOW_NAV: readonly ShellNavItem[] = [
  { href: '/records', label: 'Records' },
  { href: '/data', label: 'Data' },
  { href: '/law', label: 'Law' },
  { href: '/books', label: 'Banned books' },
  { href: '/memorial', label: 'Memorial' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/corrections', label: 'Corrections' },
  { href: '/errata', label: 'Errata' },
  { href: '/submit', label: 'Submit' },
] as const;

export type FooterNavColumn = {
  readonly title: string;
  readonly items: readonly ShellNavItem[];
};

/**
 * Three mono-caps footer columns per the v3 shell contract.
 *
 * The public web footer no longer reads this: it derives its columns from
 * `apps/web/src/lib/nav/destination-registry.ts`, so a route joins the footer by existing rather
 * than by being remembered. This list remains for the admin shell, which has no access to the
 * web app's registry, and is kept in step by `shell-nav.test.ts`.
 */
export const FOOTER_NAV_COLUMNS: readonly FooterNavColumn[] = [
  {
    title: 'Explore',
    items: [
      { href: '/explore', label: 'Explore' },
      { href: '/library', label: 'Library' },
      { href: '/records', label: 'Records' },
      { href: '/chapters', label: 'Chapters' },
      { href: '/data', label: 'Data' },
      { href: '/law', label: 'Law' },
      { href: '/books', label: 'Banned books' },
    ],
  },
  {
    title: 'Trust',
    items: [
      { href: '/methodology', label: 'Methodology' },
      { href: '/memorial', label: 'Memorial' },
      { href: '/errata', label: 'Errata' },
      { href: '/corrections', label: 'Corrections' },
    ],
  },
  {
    title: 'Contribute',
    items: [
      { href: '/submit', label: 'Submit' },
      { href: '/about', label: 'About' },
    ],
  },
] as const;

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
