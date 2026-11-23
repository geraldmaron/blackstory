/**
 * The four primary tabs, Archive, Stories, Data and Memorial, shared by the desktop header and
 * the phone tab bar so the two can never disagree about the set, the order or which one is
 * current. Search sits beside them in the header (DESIGN.md 7.6, `Nav`).
 *
 * Built from the destination registry, not written out. The lenses (law, books, presidents,
 * inventions) live inside the Archive; trust pages and forms hang off About and the footer.
 */
import { primaryNavDestinations } from '../../lib/nav/destination-registry';
import type { DestinationIconId } from '@repo/public-contracts/destinations';

export type ShellTabId = '/archive' | '/stories' | '/data' | '/memorial';

export type ShellTab = {
  readonly id: ShellTabId;
  readonly label: string;
  readonly href: string;
  readonly icon: DestinationIconId;
};

export const SHELL_TABS: readonly ShellTab[] = primaryNavDestinations().map((destination) => ({
  id: destination.path as ShellTabId,
  label: destination.label,
  href: destination.path,
  icon: destination.icon,
}));

/** A record belongs to the Archive, the catalog that lists it; so do the lens pages. */
const ARCHIVE_PREFIXES = [
  '/archive',
  '/explore',
  '/records',
  '/entity',
  '/place',
  '/invention',
  '/law',
  '/books',
] as const;

function under(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Which tab is current. No tab is current on the front page or a method page. */
export function currentTabFor(pathname: string): ShellTabId | null {
  if (under(pathname, '/stories') || under(pathname, '/presidents')) return '/stories';
  if (under(pathname, '/data') || under(pathname, '/lives')) return '/data';
  if (under(pathname, '/memorial')) return '/memorial';
  if (ARCHIVE_PREFIXES.some((path) => under(pathname, path))) return '/archive';
  return null;
}
