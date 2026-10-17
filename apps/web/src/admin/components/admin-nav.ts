/**
 * Single source of truth for admin information architecture.
 *
 * Surfaces are grouped by where they sit in the work an operator does, in pipeline order: material
 * arrives (Intake), is researched (Research), lands in the Catalog, is backed by Sources, and is
 * published (Publish); System holds the audit trail and kill switches. The sidebar, the mobile
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
  label: 'Work',
  keywords: ['ops', 'home', 'queue', 'dashboard', 'overview'],
};

export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    id: 'intake',
    label: 'Intake',
    destinations: [
      {
        href: '/admin/submissions',
        label: 'Submissions',
        queue: 'submissions',
        keywords: ['intake', 'quarantine', 'leads', 'corrections', 'appeals', 'abuse'],
      },
      { href: '/admin/graylist', label: 'Graylist', keywords: ['blocked', 'held', 'suppressed'] },
      { href: '/admin/discovery', label: 'Discovery runs', keywords: ['crawl', 'harvest'] },
    ],
  },
  {
    id: 'research',
    label: 'Research',
    destinations: [
      {
        href: '/admin/inbox',
        label: 'Inbox',
        queue: 'inbox',
        keywords: ['triage', 'pending', 'incoming', 'cases'],
      },
      { href: '/admin/cases', label: 'Research cases', keywords: ['queue', 'promote', 'all'] },
      { href: '/admin/work', label: 'Requests', keywords: ['research', 'review', 'approve'] },
      { href: '/admin/evidence', label: 'Attach evidence', keywords: ['citation', 'proof'] },
      { href: '/admin/quick-add', label: 'Quick add', keywords: ['create', 'new entity'] },
    ],
  },
  {
    id: 'catalog',
    label: 'Catalog',
    destinations: [
      {
        href: '/admin/catalog',
        label: 'Entities',
        keywords: ['catalog', 'people', 'places', 'merge'],
      },
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
    id: 'publish',
    label: 'Publish',
    destinations: [
      {
        href: '/admin/stories',
        label: 'Stories',
        keywords: ['writing', 'editor', 'drafts'],
      },
      {
        href: '/admin/stories/review',
        label: 'Story review',
        queue: 'storyReview',
        keywords: ['packets'],
      },
      {
        href: '/admin/stories/contributors',
        label: 'Contributors',
        keywords: ['author', 'profile', 'byline', 'neo'],
      },
      { href: '/admin/releases', label: 'Releases', keywords: ['ship', 'publish'] },
    ],
  },
  {
    id: 'system',
    label: 'System',
    destinations: [
      { href: '/admin/audit', label: 'Audit log', keywords: ['history', 'who did'] },
      { href: '/admin/switches', label: 'Switches', keywords: ['flags', 'toggles', 'kill switch'] },
    ],
  },
];

/**
 * Every admin destination as a palette command. The palette is the navigator, so nothing is left
 * out for being visible in the sidebar.
 */
export function adminPaletteItems(
  extras: readonly { readonly href: string; readonly label: string; readonly group: string }[] = [],
): readonly CommandPaletteItem[] {
  return [
    {
      id: ADMIN_HOME.href,
      label: ADMIN_HOME.label,
      hint: ADMIN_HOME.href,
      ...keywordsOf(ADMIN_HOME),
    },
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
