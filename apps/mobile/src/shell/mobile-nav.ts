/**
 * Mobile shell IA — tab order, More menu sections, and route targets aligned with
 * `packages/config/src/shell-nav.ts` (web PRIMARY_NAV + OVERFLOW_NAV). Keep labels
 * and ordering in sync when web shell nav changes.
 */
import type { NavIconName } from '@/ui/NavIcon';

/** Keep in sync with `src/features/entity/share.ts` — duplicated here to avoid a route-params cycle. */
const CANONICAL_WEB_ORIGIN = 'https://blackbook.app';

export type MobileTabId = 'explore' | 'history' | 'stories' | 'more';

export type MobileTabDefinition = {
  readonly id: MobileTabId;
  readonly label: string;
  /** Expo Router tab root path (no group prefix). */
  readonly route: `/${string}`;
  readonly icon: NavIconName;
};

/** Bottom tab bar — mirrors web PRIMARY_NAV except About lives in More on mobile. */
export const MOBILE_PRIMARY_TABS: readonly MobileTabDefinition[] = [
  { id: 'explore', label: 'Explore', route: '/explore', icon: 'explore' },
  { id: 'history', label: 'History', route: '/history', icon: 'history' },
  { id: 'stories', label: 'Stories', route: '/learn', icon: 'stories' },
  { id: 'more', label: 'More', route: '/more', icon: 'more' },
] as const;

export type MobileMoreDestination =
  | { readonly kind: 'native'; readonly route: `/${string}` }
  | { readonly kind: 'web'; readonly href: string };

export type MobileMoreRow = {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: NavIconName;
  readonly destination: MobileMoreDestination;
};

export type MobileMoreSection = {
  readonly id: string;
  readonly title: string;
  readonly meta: string;
  readonly rows: readonly MobileMoreRow[];
};

/** More tab ledger — About first, then web overflow IA grouped like the site footer. */
export const MOBILE_MORE_SECTIONS: readonly MobileMoreSection[] = [
  {
    id: 'about',
    title: 'About BlackStory',
    meta: 'Overview',
    rows: [
      {
        id: 'about',
        title: 'About',
        subtitle: 'Mission, scope, and how to reach us',
        icon: 'about',
        destination: { kind: 'native', route: '/learn/about' },
      },
    ],
  },
  {
    id: 'explore-more',
    title: 'Explore more',
    meta: 'Catalog',
    rows: [
      {
        id: 'data',
        title: 'Data',
        subtitle: 'National rollups and Phase 1 indicators',
        icon: 'data',
        destination: { kind: 'native', route: '/data' },
      },
      {
        id: 'law',
        title: 'Law',
        subtitle: 'Plain-language law reference (opens web)',
        icon: 'lawRef',
        destination: { kind: 'web', href: `${CANONICAL_WEB_ORIGIN}/law` },
      },
      {
        id: 'books',
        title: 'Banned books',
        subtitle: 'Challenged titles with cited reports (opens web)',
        icon: 'books',
        destination: { kind: 'web', href: `${CANONICAL_WEB_ORIGIN}/books` },
      },
    ],
  },
  {
    id: 'trust',
    title: 'Trust',
    meta: 'Method & corrections',
    rows: [
      {
        id: 'methodology',
        title: 'Methodology',
        subtitle: 'How records are researched and verified',
        icon: 'methodology',
        destination: { kind: 'native', route: '/learn/methodology' },
      },
      {
        id: 'memorial',
        title: 'Memorial',
        subtitle: 'Names held in remembrance (opens web)',
        icon: 'about',
        destination: { kind: 'web', href: `${CANONICAL_WEB_ORIGIN}/memorial` },
      },
      {
        id: 'corrections',
        title: 'Corrections',
        subtitle: 'Report an error in a published record',
        icon: 'corrections',
        destination: { kind: 'native', route: '/corrections/submit' },
      },
      {
        id: 'errata',
        title: 'Errata',
        subtitle: 'Corrections and change log',
        icon: 'errata',
        destination: { kind: 'native', route: '/learn/errata' },
      },
    ],
  },
  {
    id: 'contribute',
    title: 'Contribute',
    meta: 'Community',
    rows: [
      {
        id: 'submit',
        title: 'Submit',
        subtitle: 'Share a lead or source (opens web)',
        icon: 'submit',
        destination: { kind: 'web', href: `${CANONICAL_WEB_ORIGIN}/submit` },
      },
    ],
  },
] as const;

/** Tab roots allowed for cold-start restore and returnTo params. */
export const MOBILE_TAB_ROOTS: readonly `/${string}`[] = MOBILE_PRIMARY_TABS.map(
  (tab) => tab.route,
);

/** Legacy Search tab path — redirects to History (web `/search` → `/history`). */
export const MOBILE_LEGACY_SEARCH_ROUTE = '/search' as const;

export const MOBILE_HISTORY_ROUTE = '/history' as const;

/** Normalizes legacy `/search` deep links to the History tab root. */
export function normalizeMobileTabRoot(route: `/${string}`): `/${string}` {
  return route === MOBILE_LEGACY_SEARCH_ROUTE ? MOBILE_HISTORY_ROUTE : route;
}

export function findMobileTab(id: MobileTabId): MobileTabDefinition | undefined {
  return MOBILE_PRIMARY_TABS.find((tab) => tab.id === id);
}
