/**
 * Learn/More tab index registry (MOB-015 requirement #1).
 *
 * One small table drives both tab index screens and the nested `/learn/[section]/*` routes, so
 * the "which sections exist, what do they show, where do they navigate" decision lives in exactly
 * one place. `routeId` is the URL segment (`/learn/{routeId}`); `catalogSection` is the
 * `content-catalog.ts` partition it reads from — kept distinct because "Privacy" is a direct
 * shortcut into the same `legal` catalog partition "Legal" also lists (matching the task's
 * request for a standalone Privacy row alongside a fuller Legal list).
 *
 * "Topics" mirrors web's own `/topics` route, which is a **permanent redirect to `/stories`**
 * (`apps/web/src/app/topics/page.tsx`) — so this registry does not invent a second, separate
 * "Topics" content partition; it points the Topics row at the same story-shaped catalog partition
 * (`topics`, populated with the same kind of long-form narrative entries `/stories` uses on web).
 */
import type { CatalogSectionId } from './content-catalog';

export interface LearnMoreSectionRow {
  readonly routeId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly catalogSection: CatalogSectionId;
  /** When set, this row has exactly one page and navigates straight to it rather than through an
   * intermediate "pick a slug" index screen. */
  readonly directSlug?: string;
}

export const LEARN_SECTIONS: readonly LearnMoreSectionRow[] = [
  {
    routeId: 'history',
    title: 'History',
    subtitle: 'Decade-by-decade context pinned to place',
    catalogSection: 'history',
  },
  {
    routeId: 'topics',
    title: 'Stories',
    subtitle: 'Longform history pinned to place and evidence',
    catalogSection: 'topics',
  },
  {
    routeId: 'myths',
    title: 'Myths',
    subtitle: 'Common misconceptions, corrected with sources',
    catalogSection: 'myths',
  },
  {
    routeId: 'methodology',
    title: 'Methodology',
    subtitle: 'How records are researched and verified',
    catalogSection: 'methodology',
    directSlug: 'overview',
  },
];

export const MORE_SECTIONS: readonly LearnMoreSectionRow[] = [
  {
    routeId: 'about',
    title: 'About',
    subtitle: 'web: /about',
    catalogSection: 'about',
    directSlug: 'about',
  },
  {
    routeId: 'facts',
    title: 'Quick facts',
    subtitle: 'web: /facts',
    catalogSection: 'facts',
    directSlug: 'quick-facts',
  },
  {
    routeId: 'legal',
    title: 'Legal',
    subtitle: 'Privacy and terms (web: /legal)',
    catalogSection: 'legal',
  },
  {
    routeId: 'privacy',
    title: 'Privacy',
    subtitle: 'What this app collects — and does not',
    catalogSection: 'legal',
    directSlug: 'privacy',
  },
  {
    routeId: 'errata',
    title: 'Errata',
    subtitle: 'Corrections and change log (web: /errata)',
    catalogSection: 'errata',
    directSlug: 'errata',
  },
];

export const ALL_SECTIONS: readonly LearnMoreSectionRow[] = [...LEARN_SECTIONS, ...MORE_SECTIONS];

export function findSectionRow(routeId: string): LearnMoreSectionRow | undefined {
  return ALL_SECTIONS.find((row) => row.routeId === routeId);
}
