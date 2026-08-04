/**
 * Single source of truth for admin information architecture.
 *
 * The shell used to carry seven primary links plus ten in More, with Inbox reachable three
 * separate ways. The fix is not a shorter list of the same links — it is grouping the surfaces by
 * the task an operator is doing, promoting one entry point per task to the bar, and making the
 * command palette the way you reach everything else. Adding a surface means adding it to a group
 * here; it lands in More and in the palette automatically, and nothing else needs editing.
 */

import type { CommandPaletteItem, ShellNavItem } from '@repo/ui';

export type AdminNavDestination = {
  readonly href: string;
  readonly label: string;
  /** Extra palette match terms for names operators use that are not in the label. */
  readonly keywords?: readonly string[];
};

export type AdminNavGroup = {
  readonly id: string;
  readonly label: string;
  /**
   * The first destination is the group's entry point and is the one promoted to the shell bar.
   * The rest live in More and in the palette.
   */
  readonly destinations: readonly [AdminNavDestination, ...AdminNavDestination[]];
};

export const ADMIN_HOME: AdminNavDestination = {
  href: '/',
  label: 'Work',
  keywords: ['ops', 'home', 'queue', 'dashboard'],
};

export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    id: 'triage',
    label: 'Triage',
    destinations: [
      { href: '/inbox', label: 'Inbox', keywords: ['submissions', 'intake', 'incoming'] },
      { href: '/cases', label: 'Research cases', keywords: ['queue', 'promote'] },
      { href: '/graylist', label: 'Graylist', keywords: ['blocked', 'held', 'suppressed'] },
    ],
  },
  {
    id: 'catalog',
    label: 'Catalog',
    destinations: [
      { href: '/catalog', label: 'Entities', keywords: ['catalog', 'people', 'places', 'merge'] },
      { href: '/quick-add', label: 'Quick add', keywords: ['create', 'new entity'] },
      { href: '/evidence', label: 'Attach evidence', keywords: ['citation', 'proof'] },
    ],
  },
  {
    id: 'sources',
    label: 'Sources',
    destinations: [
      { href: '/sources', label: 'Sources', keywords: ['feeds', 'publishers'] },
      { href: '/discovery', label: 'Discovery runs', keywords: ['crawl', 'harvest'] },
      { href: '/citation-health', label: 'Citation health', keywords: ['links', 'rot', 'broken'] },
    ],
  },
  {
    id: 'publish',
    label: 'Publish',
    destinations: [
      { href: '/stories/review', label: 'Story review', keywords: ['packets', 'drafts'] },
      { href: '/releases', label: 'Releases', keywords: ['ship', 'publish'] },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    destinations: [
      { href: '/audit', label: 'Audit log', keywords: ['history', 'who did'] },
      { href: '/switches', label: 'Switches', keywords: ['flags', 'toggles', 'kill switch'] },
    ],
  },
];

/** Groups whose entry point earns a slot in the shell bar. Admin is palette- and More-only. */
const BAR_GROUP_IDS: readonly string[] = ['triage', 'catalog', 'sources', 'publish'];

function entryPoint(group: AdminNavGroup): AdminNavDestination {
  return group.destinations[0];
}

/** Work, plus one entry point per task group. Everything else is More or the palette. */
export function adminPrimaryNav(): readonly ShellNavItem[] {
  return [
    { href: ADMIN_HOME.href, label: ADMIN_HOME.label },
    ...ADMIN_NAV_GROUPS.filter((group) => BAR_GROUP_IDS.includes(group.id)).map((group) => {
      const lead = entryPoint(group);
      return { href: lead.href, label: lead.label };
    }),
  ];
}

/** Every destination not already on the bar, in group order, followed by caller-supplied extras. */
export function adminOverflowNav(extras: readonly ShellNavItem[] = []): readonly ShellNavItem[] {
  const onBar = new Set(adminPrimaryNav().map((item) => item.href));
  return [
    ...ADMIN_NAV_GROUPS.flatMap((group) =>
      group.destinations
        .filter((destination) => !onBar.has(destination.href))
        .map((destination) => ({ href: destination.href, label: destination.label })),
    ),
    ...extras,
  ];
}

/**
 * Every admin destination as a palette command — including the ones on the bar, because the
 * palette is the navigator, and having to remember which links are also in the chrome would
 * defeat the point.
 */
export function adminPaletteItems(
  extras: readonly { readonly href: string; readonly label: string; readonly group: string }[] = [],
): readonly CommandPaletteItem[] {
  return [
    { id: ADMIN_HOME.href, label: ADMIN_HOME.label, hint: ADMIN_HOME.href, ...keywordsOf(ADMIN_HOME) },
    ...ADMIN_NAV_GROUPS.flatMap((group) =>
      group.destinations.map((destination) => ({
        id: destination.href,
        label: destination.label,
        group: group.label,
        hint: destination.href,
        ...keywordsOf(destination),
      })),
    ),
    ...extras.map((extra) => ({ id: extra.href, label: extra.label, group: extra.group })),
  ];
}

function keywordsOf(destination: AdminNavDestination): { keywords?: readonly string[] } {
  return destination.keywords ? { keywords: destination.keywords } : {};
}
