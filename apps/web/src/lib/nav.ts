/**
 * Primary navigation items for the public Black Book application shell (BB-048).
 */

export type NavItem = {
  readonly href: string;
  readonly label: string;
};

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/search', label: 'Search' },
  { href: '/history', label: 'History' },
  { href: '/facts', label: 'Facts' },
  { href: '/legal', label: 'Legal' },
  { href: '/topics', label: 'Topics' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/myths', label: 'Myths' },
  { href: '/about', label: 'About' },
  { href: '/corrections', label: 'Corrections' },
] as const;

/** Compact footer links — editorial close + dev fixtures. */
export const FOOTER_NAV: readonly NavItem[] = [
  { href: '/explore', label: 'Explore' },
  { href: '/search', label: 'Search' },
  { href: '/history', label: 'History' },
  { href: '/facts', label: 'Facts' },
  { href: '/legal', label: 'Legal' },
  { href: '/topics', label: 'Topics' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/errata', label: 'Errata' },
  { href: '/myths', label: 'Myths' },
  { href: '/about', label: 'About' },
  { href: '/corrections', label: 'Corrections' },
  { href: '/design-system', label: 'Design system' },
] as const;

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
