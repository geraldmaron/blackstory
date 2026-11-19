/**
 * The four primary tabs, Map, Records, Stories and Collections, shared by the desktop header and
 * the phone tab bar so the two can never disagree about the set, the order or which one is
 * current.
 *
 * Built from the destination registry's product axes, not written out. The registry owns what a
 * destination is; the web shell owns the order (the catalog leaves menu position and
 * presentation to each platform). Trust pages and forms belong to no tab: they hang off About and
 * the footer.
 */
import { destinationsInGroup, primaryNavDestinations } from '../../lib/nav/destination-registry';
import type { DestinationIconId } from '@repo/public-contracts/destinations';

export type ShellTabId = '/explore' | '/records' | '/stories' | '/collections';

export type ShellTab = {
  readonly id: ShellTabId;
  readonly label: string;
  /** Where the tab goes: the axis's own page. Map is the navigable map, `/explore`; the lockup is
   * the way to the Door (`/`). Owner decision 2026-11-16. */
  readonly href: string;
  readonly icon: DestinationIconId;
};

const ORDER: readonly ShellTabId[] = ['/explore', '/records', '/stories', '/collections'];

const AXES = new Map(primaryNavDestinations().map((axis) => [axis.path, axis]));

export const SHELL_TABS: readonly ShellTab[] = ORDER.map((id) => {
  const axis = AXES.get(id);
  if (!axis) throw new Error(`SHELL_TABS: ${id} is not a primary destination`);
  return {
    id,
    label: axis.label,
    href: axis.path,
    icon: axis.icon,
  };
});

const COLLECTION_PATHS = destinationsInGroup('read').map((destination) => destination.path);

const RECORD_PREFIXES = ['/records', '/search', '/entity', '/place', '/invention'] as const;

function under(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function pathIsMapSurface(pathname: string): boolean {
  return pathname === '/' || under(pathname, '/explore');
}

/** Which tab is current. A record page belongs to Records, the catalog that lists it. */
export function currentTabFor(pathname: string): ShellTabId | null {
  if (pathIsMapSurface(pathname)) return '/explore';
  if (under(pathname, '/stories')) return '/stories';
  if (RECORD_PREFIXES.some((path) => under(pathname, path))) return '/records';
  if (under(pathname, '/collections') || COLLECTION_PATHS.some((path) => under(pathname, path))) {
    return '/collections';
  }
  return null;
}
