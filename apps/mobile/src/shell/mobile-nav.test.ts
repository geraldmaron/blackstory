/**
 * The native shell's IA, asserted against the shared destination catalog rather than against a
 * second copy of the menu.
 *
 * The previous generation of this file asserted the literal tab list
 * `['Explore', 'History', 'Stories', 'More']` and passed while `History` was the search screen
 * under another name and `Stories` pushed `/learn`. A test that agrees with the drift cannot
 * catch it.
 */
import {
  canonicalPathForLegacy,
  isLegacyPath,
  semanticDestinationByPath,
} from '@repo/public-contracts/destinations';

import {
  MOBILE_LEGACY_SEARCH_ROUTE,
  MOBILE_MORE_SECTIONS,
  MOBILE_PRIMARY_TABS,
  MOBILE_RECORDS_ROUTE,
  MOBILE_TAB_ROOTS,
  nativeLegacyRoutes,
  nativeRouteForWebPath,
  normalizeMobileTabRoot,
} from './mobile-nav';

const allRows = MOBILE_MORE_SECTIONS.flatMap((section) => section.rows);

describe('MOBILE_PRIMARY_TABS', () => {
  it('is the three product axes a phone navigates between, plus More', () => {
    expect(MOBILE_PRIMARY_TABS.map((tab) => tab.label)).toEqual([
      'Explore',
      'Stories',
      'Records',
      'More',
    ]);
    expect(MOBILE_PRIMARY_TABS.map((tab) => tab.route)).toEqual([
      '/explore',
      '/stories',
      '/records',
      '/more',
    ]);
  });

  it('has no History tab: chronology is an era filter, not a destination', () => {
    // Compared as strings: `MobileTabId` no longer has a `history` member, which is the point.
    const ids: readonly string[] = MOBILE_PRIMARY_TABS.map((tab) => tab.id);
    expect(ids).not.toContain('history');
    expect(MOBILE_PRIMARY_TABS.some((tab) => tab.label === 'History')).toBe(false);
  });

  it('does not expose a standalone Search tab: search is a capability of Records', () => {
    expect(MOBILE_PRIMARY_TABS.some((tab) => tab.label === 'Search')).toBe(false);
    expect(MOBILE_PRIMARY_TABS.some((tab) => tab.route === '/records')).toBe(true);
  });

  it('does not push a route that is a legacy alias', () => {
    for (const tab of MOBILE_PRIMARY_TABS) {
      expect(isLegacyPath(tab.route)).toBe(false);
    }
    const routes: readonly string[] = MOBILE_PRIMARY_TABS.map((tab) => tab.route);
    expect(routes).not.toContain('/learn');
  });

  it('takes each axis label and route from the shared catalog', () => {
    for (const tab of MOBILE_PRIMARY_TABS) {
      if (tab.id === 'more') continue;
      const destination = semanticDestinationByPath(tab.route);
      expect(destination).toBeDefined();
      expect(tab.label).toBe(destination?.label);
    }
  });

  it('registers four tab roots for restore/returnTo allowlists', () => {
    expect(MOBILE_TAB_ROOTS).toEqual(['/explore', '/stories', '/records', '/more']);
  });
});

describe('MOBILE_MORE_SECTIONS', () => {
  it('groups the supporting rooms the way the web hub groups them', () => {
    expect(MOBILE_MORE_SECTIONS.map((section) => section.title)).toEqual([
      'Read deeper',
      'Trust & About',
      'Take part',
      'Policies',
    ]);
    expect(MOBILE_MORE_SECTIONS[0]?.rows.map((row) => row.title)).toEqual([
      'Law',
      'Data',
      'Banned books',
      'Memorial',
    ]);
    expect(MOBILE_MORE_SECTIONS[1]?.rows.map((row) => row.title)).toEqual([
      'About',
      'Questions',
      'Methodology',
      'Errata',
    ]);
    expect(MOBILE_MORE_SECTIONS[2]?.rows.map((row) => row.title)).toEqual([
      'Submit',
      'Corrections',
      'Support',
    ]);
    expect(MOBILE_MORE_SECTIONS[3]?.rows.map((row) => row.title)).toEqual(['Privacy']);
  });

  it('never duplicates a primary tab inside More', () => {
    const tabRoutes = new Set(MOBILE_PRIMARY_TABS.map((tab) => tab.route));
    for (const row of allRows) {
      if (row.destination.kind !== 'native') continue;
      expect(tabRoutes.has(row.destination.route)).toBe(false);
    }
  });

  it('does not list Themes: a theme is a Story collection, not a peer destination', () => {
    expect(allRows.some((row) => row.id === 'themes')).toBe(false);
  });

  it('does not list an ambiguous Legal row, and files Privacy under Policies', () => {
    // "Legal" meant product policy while `/law` meant historical statute, which is exactly how a
    // reader looking for a privacy notice could land in the civil-rights statute reference.
    expect(allRows.some((row) => row.title === 'Legal')).toBe(false);
    const privacy = allRows.find((row) => row.id === 'privacy');
    expect(privacy?.destination).toEqual({ kind: 'native', route: '/privacy' });
    const law = allRows.find((row) => row.id === 'law');
    expect(law?.destination).toEqual({ kind: 'native', route: '/law' });
  });

  it('does not list Quick facts: it duplicated the Records tab', () => {
    expect(allRows.some((row) => row.id === 'facts')).toBe(false);
  });

  it('never names a web route at the reader', () => {
    for (const row of allRows) {
      expect(row.subtitle).not.toMatch(/\bweb:/i);
      expect(row.subtitle).not.toMatch(/^\//);
      expect(row.subtitle.length).toBeGreaterThan(0);
    }
  });

  it('routes each row to a native screen, or says plainly that it opens the web', () => {
    for (const row of allRows) {
      if (row.destination.kind === 'native') {
        expect(row.destination.route.startsWith('/')).toBe(true);
        expect(isLegacyPath(row.destination.route)).toBe(false);
      } else {
        expect(row.destination.href).toMatch(/^https:\/\/blackstory\.app\//);
      }
    }
  });

  it('carries no BlackBook remnant in any destination', () => {
    for (const row of allRows) {
      const target =
        row.destination.kind === 'native' ? row.destination.route : row.destination.href;
      expect(target).not.toMatch(/blackbook/i);
    }
  });
});

describe('normalizeMobileTabRoot', () => {
  it('sends the legacy find-in-time roots to Records', () => {
    expect(normalizeMobileTabRoot(MOBILE_LEGACY_SEARCH_ROUTE)).toBe(MOBILE_RECORDS_ROUTE);
    expect(normalizeMobileTabRoot('/history')).toBe(MOBILE_RECORDS_ROUTE);
  });

  it('sends the legacy narrative roots to Stories', () => {
    expect(normalizeMobileTabRoot('/learn')).toBe('/stories');
    expect(normalizeMobileTabRoot('/topics')).toBe('/stories');
    expect(normalizeMobileTabRoot('/myths')).toBe('/stories');
  });

  it('leaves a canonical route alone', () => {
    expect(normalizeMobileTabRoot('/explore')).toBe('/explore');
    expect(normalizeMobileTabRoot('/records')).toBe('/records');
    expect(normalizeMobileTabRoot('/stories')).toBe('/stories');
  });

  it('normalizes to a canonical route, never to another legacy one', () => {
    for (const [, target] of nativeLegacyRoutes()) {
      expect(isLegacyPath(target)).toBe(false);
    }
  });

  it('agrees with the shared catalog wherever the catalog has an opinion', () => {
    // The phone may normalize a route the site never had (`/learn`), but where both know an
    // address they must land in the same place — otherwise a shared link opens two products.
    for (const [from, target] of nativeLegacyRoutes()) {
      const shared = canonicalPathForLegacy(from);
      if (shared === null) continue;
      // Through the one declared platform equivalence: the web hub `/rooms` is the phone's More.
      expect(target).toBe(nativeRouteForWebPath(shared));
    }
  });

  it('declares exactly one web-to-native route difference, and says why', () => {
    // Every other destination uses the same path on both platforms. A second entry here would
    // mean the two products had started to diverge in addressing, not just in presentation.
    expect(nativeRouteForWebPath('/rooms')).toBe('/more');
    expect(nativeRouteForWebPath('/records')).toBe('/records');
    expect(nativeRouteForWebPath('/stories')).toBe('/stories');
  });
});
