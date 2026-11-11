/**
 * Single source of truth for admin information architecture.
 *
 * Surfaces are grouped by the job the owner is doing: Write (stories and bylines), Records (the
 * entity catalog), Intake (everything that arrives and waits for a decision), Sources, and System
 * (releases, audit trail, kill switches). Today sits above the groups. The sidebar, the mobile
 * drawer and the command palette all render from this list, so adding a surface means adding it to
 * a group here and nothing else.
 */

import type { CommandPaletteItem } from '@repo/ui';

/** Queue sizes a destination can badge; the values come from `/admin/api/queue-counts`. */
export type AdminQueueKey = 'submissions' | 'inbox' | 'storyReview';

export type AdminNavDestination = {
  readonly href: string;
  readonly label: string;
  /** Extra palette match terms for names operators use that are not in the label. */
  readonly keywords?: readonly string[];
  /** When set, the sidebar shows this queue's size beside the label. */
  readonly queue?: AdminQueueKey;
};

export type AdminNavGroup = {
  readonly id: string;
  readonly label: string;
  readonly destinations: readonly [AdminNavDestination, ...AdminNavDestination[]];
};

export const ADMIN_HOME: AdminNavDestination = {
  href: '/admin',
  label: 'Today',
  keywords: ['work', 'ops', 'operations', 'home', 'dashboard', 'overview', 'pick up'],
};

/** Destinations shown above the groups, in order. */
export const ADMIN_TOP_LEVEL: readonly AdminNavDestination[] = [ADMIN_HOME];

export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    id: 'write',
    label: 'Write',
    destinations: [
      { href: '/admin/stories', label: 'Stories', keywords: ['writing', 'editor', 'drafts'] },
      {
        href: '/admin/stories/review',
        label: 'Story review',
        queue: 'storyReview',
        keywords: ['packets'],
      },
      {
        href: '/admin/stories/contributors',
        label: 'People & bylines',
        keywords: ['contributors', 'author', 'profile', 'byline', 'neo'],
      },
    ],
  },
  {
    id: 'records',
    label: 'Records',
    destinations: [
      {
        href: '/admin/catalog',
        label: 'Entities',
        keywords: ['catalog', 'people', 'places', 'merge'],
      },
      {
        href: '/admin/footprint',
        label: 'Footprint',
        keywords: ['map', 'coverage', 'states', 'gaps', 'geography'],
      },
    ],
  },
  {
    id: 'intake',
    label: 'Intake',
    destinations: [
      {
        href: '/admin/queue',
        label: 'Queue',
        keywords: ['open work', 'todo', 'pending', 'oldest', 'triage'],
      },
      {
        href: '/admin/submissions',
        label: 'Submissions',
        queue: 'submissions',
        keywords: ['intake', 'quarantine', 'leads', 'corrections', 'appeals', 'abuse'],
      },
      {
        href: '/admin/inbox',
        label: 'Inbox',
        queue: 'inbox',
        keywords: ['triage', 'pending', 'incoming', 'cases'],
      },
      { href: '/admin/cases', label: 'Research cases', keywords: ['queue', 'promote', 'all'] },
      {
        href: '/admin/work',
        label: 'Requests',
        keywords: ['work', 'operations', 'research', 'review', 'approve'],
      },
      { href: '/admin/graylist', label: 'Graylist', keywords: ['blocked', 'held', 'suppressed'] },
      { href: '/admin/discovery', label: 'Discovery runs', keywords: ['crawl', 'harvest'] },
      { href: '/admin/quick-add', label: 'Quick add', keywords: ['create', 'new entity'] },
      { href: '/admin/evidence', label: 'Attach evidence', keywords: ['citation', 'proof'] },
    ],
  },
  {
    id: 'sources',
    label: 'Sources',
    destinations: [
      { href: '/admin/sources', label: 'Sources', keywords: ['feeds', 'publishers'] },
      {
        href: '/admin/citation-health',
        label: 'Citation health',
        keywords: ['links', 'rot', 'broken'],
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    destinations: [
      { href: '/admin/releases', label: 'Releases', keywords: ['ship', 'publish'] },
      { href: '/admin/audit', label: 'Audit log', keywords: ['history', 'who did'] },
      { href: '/admin/switches', label: 'Switches', keywords: ['flags', 'toggles', 'kill switch'] },
    ],
  },
];

/**
 * The one destination a path belongs to: the longest href that is the path or a parent of it, so
 * /admin/stories/contributors lights People & bylines and not Stories. /admin matches only itself.
 */
export function activeDestination(pathname: string): string | null {
  let best: string | null = null;
  for (const { href } of [
    ...ADMIN_TOP_LEVEL,
    ...ADMIN_NAV_GROUPS.flatMap((group) => group.destinations),
  ]) {
    const matches =
      href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (!best || href.length > best.length)) best = href;
  }
  return best;
}

/**
 * Every admin destination as a palette command. The palette is the navigator, so nothing is left
 * out for being visible in the sidebar.
 */
export function adminPaletteItems(
  extras: readonly { readonly href: string; readonly label: string; readonly group: string }[] = [],
): readonly CommandPaletteItem[] {
  return [
    ...ADMIN_TOP_LEVEL.map((destination) => ({
      id: destination.href,
      label: destination.label,
      hint: destination.href,
      ...keywordsOf(destination),
    })),
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
