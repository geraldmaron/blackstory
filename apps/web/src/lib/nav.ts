/**
 * Primary navigation items for the public Black Book application shell (BB-048).
 */

export type NavItem = {
  readonly href: string;
  readonly label: string;
};

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/search', label: 'Search' },
  { href: '/explore', label: 'Explore' },
  { href: '/topics', label: 'Topics' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/about', label: 'About' },
  { href: '/corrections', label: 'Corrections' },
] as const;

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
