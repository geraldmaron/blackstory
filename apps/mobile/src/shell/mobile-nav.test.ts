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
  MOBILE_TAB_ROOTS,
  nativeLegacyRoutes,
  nativeRouteForWebPath,
  normalizeMobileTabRoot,
} from './mobile-nav';

const allRows = MOBILE_MORE_SECTIONS.flatMap((section) => section.rows);

describe('MOBILE_PRIMARY_TABS', () => {
  it('is Archive, Stories, Data, More, in that order', () => {
    expect(MOBILE_PRIMARY_TABS.map((tab) => tab.label)).toEqual([
      'Archive',
      'Stories',
      'Data',
      'More',
    ]);
    expect(MOBILE_PRIMARY_TABS.map((tab) => tab.route)).toEqual([
      '/archive',
      '/stories',
      '/data',
      '/more',
    ]);
  });

  it('has no History tab: chronology is an era filter, not a destination', () => {
    // Compared as strings: `MobileTabId` no longer has a `history` member, which is the point.
    const ids: readonly string[] = MOBILE_PRIMARY_TABS.map((tab) => tab.id);
    expect(ids).not.toContain('history');
    expect(MOBILE_PRIMARY_TABS.some((tab) => tab.label === 'History')).toBe(false);
  });

  it('does not expose a standalone Search tab: search is the Archive list', () => {
    expect(MOBILE_PRIMARY_TABS.some((tab) => tab.label === 'Search')).toBe(false);
    expect(MOBILE_PRIMARY_TABS.some((tab) => tab.route === '/archive')).toBe(true);
  });

  it('does not push a route that is a legacy alias', () => {
    for (const tab of MOBILE_PRIMARY_TABS) {
      expect(isLegacyPath(tab.route)).toBe(false);
    }
    const routes: readonly string[] = MOBILE_PRIMARY_TABS.map((tab) => tab.route);
    expect(routes).not.toContain('/learn');
  });

  it('takes Stories and Data from the shared catalog', () => {
    for (const tab of MOBILE_PRIMARY_TABS) {
      // Archive is the phone's merge of the web's map and list; the catalog has no entry yet.
      if (tab.id === 'more' || tab.id === 'archive') continue;
      const destination = semanticDestinationByPath(tab.route);
      expect(destination).toBeDefined();
      expect(tab.label).toBe(destination?.label);
    }
  });

  it('registers four tab roots for restore/returnTo allowlists', () => {
    expect(MOBILE_TAB_ROOTS).toEqual(['/archive', '/stories', '/data', '/more']);
  });
});

describe('MOBILE_MORE_SECTIONS', () => {
  it('groups the supporting pages the way the web footer groups them', () => {
    expect(MOBILE_MORE_SECTIONS.map((section) => section.title)).toEqual([
      'Collections',
      'Trust & About',
      'Take part',
      'Policies',
    ]);
    expect(MOBILE_MORE_SECTIONS[0]?.rows.map((row) => row.title)).toEqual([
      'Presidents',
      'Law',
      'Lives',
      'Banned books',
      'Memorial',
    ]);
    expect(MOBILE_MORE_SECTIONS[1]?.rows.map((row) => row.title)).toEqual([
      'About',
      'Questions',
      'Methodology',
      'Source library',
      'Errata',
    ]);
    expect(MOBILE_MORE_SECTIONS[2]?.rows.map((row) => row.title)).toEqual([
      'Submit',
      'Corrections',
      'Support',
    ]);
    expect(MOBILE_MORE_SECTIONS[3]?.rows.map((row) => row.title)).toEqual(['Privacy', 'Terms']);
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
    expect(allRows.some((row) => row.id === 'law')).toBe(true);
    // Data is a tab; a tab is not listed again inside More.
    expect(allRows.some((row) => row.id === 'data')).toBe(false);
    expect(allRows.some((row) => row.id === 'about')).toBe(true);
  });

  it('opens Law and About as native rooms', () => {
    expect(allRows.find((row) => row.id === 'how-it-works')).toBeUndefined();
    expect(allRows.find((row) => row.id === 'law')?.destination).toEqual({
      kind: 'native',
      route: '/law',
    });
    expect(allRows.find((row) => row.id === 'about')?.destination).toEqual({
      kind: 'native',
      route: '/about',
    });
  });

  it('reaches Terms as a native screen, never a web fallback to a page that does not exist', () => {
    // `/terms` has no web route. A row with no `route` opens the web surface (see
    // `moreRow`/`WEB_ORIGIN` above), so an unset route here would send a reader to a dead link
    // instead of the bundled native screen this row exists to surface.
    const terms = allRows.find((row) => row.id === 'terms');
    expect(terms?.destination).toEqual({ kind: 'native', route: '/terms' });
    expect(terms?.title).toBe('Terms');
  });

  it('does not list Quick facts: it duplicated the Records tab', () => {
    expect(allRows.some((row) => row.id === 'facts')).toBe(false);
  });

  it('gives FAQ and Support a native screen instead of opening the web', () => {
    // These two used to be the whole remaining native gap in More: every other row already had a
    // real screen, and tapping either of these left the app for Safari.
    const faq = allRows.find((row) => row.id === 'faq');
    const support = allRows.find((row) => row.id === 'support');
    expect(faq?.destination).toEqual({ kind: 'native', route: '/faq' });
    expect(support?.destination).toEqual({ kind: 'native', route: '/support' });
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
  it('sends the old tabs and the legacy find-in-time roots to the Archive', () => {
    expect(normalizeMobileTabRoot('/explore')).toBe('/archive');
    expect(normalizeMobileTabRoot('/records')).toBe('/archive');
    expect(normalizeMobileTabRoot(MOBILE_LEGACY_SEARCH_ROUTE)).toBe('/archive');
    expect(normalizeMobileTabRoot('/history')).toBe('/archive');
  });

  it('sends the legacy narrative roots to Stories', () => {
    expect(normalizeMobileTabRoot('/learn')).toBe('/stories');
    expect(normalizeMobileTabRoot('/topics')).toBe('/stories');
    expect(normalizeMobileTabRoot('/myths')).toBe('/stories');
  });

  it('leaves a canonical route alone', () => {
    expect(normalizeMobileTabRoot('/archive')).toBe('/archive');
    expect(normalizeMobileTabRoot('/data')).toBe('/data');
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
      // Through the one declared platform equivalence: the web hub `/collections` is the phone's More.
      expect(target).toBe(nativeRouteForWebPath(shared));
    }
  });

  it('declares the web-to-native route differences, and says why', () => {
    // The hub is More; and until the web merges its map and list (DESIGN.md phase 4b) both are
    // the phone's one Archive. Every other destination uses the same path on both platforms.
    expect(nativeRouteForWebPath('/collections')).toBe('/more');
    expect(nativeRouteForWebPath('/explore')).toBe('/archive');
    expect(nativeRouteForWebPath('/records')).toBe('/archive');
    expect(nativeRouteForWebPath('/stories')).toBe('/stories');
  });
});
