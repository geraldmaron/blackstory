/**
 * Navigation data for the public Blap application shell.
 *
 * IA per the v3 shell contract: five routes stay in the always-visible
 * primary nav; the rest live under the "More" disclosure (desktop nav +
 * mobile drawer) and are re-surfaced in the footer's three link columns so
 * every route that used to live in the flat top-level nav stays reachable.
 */

export type NavItem = {
  readonly href: string;
  readonly label: string;
};

/** Always-visible top-level nav — mono caps, active route gets the copper underline. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/explore', label: 'Explore' },
  { href: '/search', label: 'Search' },
  { href: '/history', label: 'History' },
  { href: '/topics', label: 'Topics' },
  { href: '/about', label: 'About' },
] as const;

/** Overflow routes: desktop "More" disclosure + appended to the mobile drawer. */
export const OVERFLOW_NAV: readonly NavItem[] = [
  { href: '/facts', label: 'Facts' },
  { href: '/legal', label: 'Legal' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/myths', label: 'Myths' },
  { href: '/corrections', label: 'Corrections' },
  { href: '/errata', label: 'Errata' },
  { href: '/submit', label: 'Submit' },
] as const;

export type FooterNavColumn = {
  readonly title: string;
  readonly items: readonly NavItem[];
};

/** Three mono-caps footer columns per the v3 shell contract. */
export const FOOTER_NAV_COLUMNS: readonly FooterNavColumn[] = [
  {
    title: 'Explore',
    items: [
      { href: '/explore', label: 'Explore' },
      { href: '/search', label: 'Search' },
      { href: '/history', label: 'History' },
      { href: '/topics', label: 'Topics' },
    ],
  },
  {
    title: 'Trust',
    items: [
      { href: '/methodology', label: 'Methodology' },
      { href: '/errata', label: 'Errata' },
      { href: '/corrections', label: 'Corrections' },
      { href: '/legal', label: 'Legal' },
    ],
  },
  {
    title: 'Contribute',
    items: [
      { href: '/submit', label: 'Submit' },
      { href: '/about', label: 'About' },
      { href: '/facts', label: 'Facts' },
      { href: '/myths', label: 'Myths' },
    ],
  },
] as const;

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
