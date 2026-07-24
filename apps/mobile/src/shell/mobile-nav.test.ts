/**
 * Mobile shell IA tests — tab order and More menu parity with web shell-nav.
 */
import {
  MOBILE_HISTORY_ROUTE,
  MOBILE_LEGACY_SEARCH_ROUTE,
  MOBILE_MORE_SECTIONS,
  MOBILE_PRIMARY_TABS,
  MOBILE_TAB_ROOTS,
  normalizeMobileTabRoot,
} from './mobile-nav';

describe('MOBILE_PRIMARY_TABS', () => {
  it('matches web primary nav order minus About (About lives in More on mobile)', () => {
    expect(MOBILE_PRIMARY_TABS.map((tab) => tab.label)).toEqual([
      'Explore',
      'History',
      'Stories',
      'More',
    ]);
  });

  it('does not expose a standalone Search tab', () => {
    expect(MOBILE_PRIMARY_TABS.some((tab) => tab.label === 'Search')).toBe(false);
    expect(MOBILE_PRIMARY_TABS.some((tab) => tab.id === 'history')).toBe(true);
  });

  it('registers four tab roots for restore/returnTo allowlists', () => {
    expect(MOBILE_TAB_ROOTS).toEqual(['/explore', '/history', '/learn', '/more']);
  });
});

describe('MOBILE_MORE_SECTIONS', () => {
  it('lists web overflow destinations in footer order', () => {
    const exploreMore = MOBILE_MORE_SECTIONS.find((section) => section.id === 'explore-more');
    expect(exploreMore?.rows.map((row) => row.title)).toEqual([
      'Data',
      'Law',
      'Banned books',
      'Themes',
    ]);
  });

  it('routes Banned books to the native catalog', () => {
    const books = MOBILE_MORE_SECTIONS.flatMap((section) => section.rows).find(
      (row) => row.id === 'books',
    );
    expect(books?.destination).toEqual({ kind: 'native', route: '/books' });
    expect(books?.subtitle).not.toMatch(/opens web/i);
  });

  it('routes Themes to the native catalog', () => {
    const themes = MOBILE_MORE_SECTIONS.flatMap((section) => section.rows).find(
      (row) => row.id === 'themes',
    );
    expect(themes?.destination).toEqual({ kind: 'native', route: '/themes' });
  });

  it('routes Submit to the native contribute shell', () => {
    const submit = MOBILE_MORE_SECTIONS.flatMap((section) => section.rows).find(
      (row) => row.id === 'submit',
    );
    expect(submit?.destination).toEqual({ kind: 'native', route: '/submit' });
    expect(submit?.subtitle).not.toMatch(/opens web/i);
  });

  it('groups trust routes under Methodology, Memorial, Corrections, and Errata', () => {
    const trust = MOBILE_MORE_SECTIONS.find((section) => section.id === 'trust');
    expect(trust?.rows.map((row) => row.title)).toEqual([
      'Methodology',
      'Memorial',
      'Corrections',
      'Errata',
    ]);
  });

  it('promotes About ahead of overflow rows', () => {
    expect(MOBILE_MORE_SECTIONS[0]?.rows[0]?.title).toBe('About');
  });
});

describe('normalizeMobileTabRoot', () => {
  it('maps legacy /search to /history', () => {
    expect(normalizeMobileTabRoot(MOBILE_LEGACY_SEARCH_ROUTE)).toBe(MOBILE_HISTORY_ROUTE);
    expect(normalizeMobileTabRoot('/explore')).toBe('/explore');
  });
});
