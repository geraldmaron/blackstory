/**
 * Shared public-shell navigation IA (primary + overflow + footer columns).
 * Used by web and admin so both surfaces render the same theme-aware shell bar.
 */

export type ShellNavItem = {
  readonly href: string;
  readonly label: string;
};

/** Always-visible top-level nav — sans caps; active route gets a copper underline. */
export const PRIMARY_NAV: readonly ShellNavItem[] = [
  { href: '/explore', label: 'Explore' },
  { href: '/history', label: 'History' },
  { href: '/stories', label: 'Stories' },
  { href: '/about', label: 'About' },
] as const;

/** Overflow routes: desktop "More" disclosure + mobile drawer. */
export const OVERFLOW_NAV: readonly ShellNavItem[] = [
  { href: '/themes', label: 'Themes' },
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

/** Three mono-caps footer columns per the v3 shell contract. */
export const FOOTER_NAV_COLUMNS: readonly FooterNavColumn[] = [
  {
    title: 'Explore',
    items: [
      { href: '/explore', label: 'Explore' },
      { href: '/history', label: 'History' },
      { href: '/stories', label: 'Stories' },
      { href: '/themes', label: 'Themes' },
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
  const base = origin.replace(/\/+$/, '');
  return items.map((item) => ({
    ...item,
    href: item.href.startsWith('http')
      ? item.href
      : `${base}${item.href.startsWith('/') ? item.href : `/${item.href}`}`,
  }));
}
