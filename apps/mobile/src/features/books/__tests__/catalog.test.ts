/**
 * Unit tests for native banned-books catalog helpers.
 */
import {
  catalogPulse,
  filterCatalogRows,
  getBookBySlug,
  listCatalogRows,
  loadBooksCatalog,
  parseBookSlug,
  plainDashCopy,
} from '../catalog';

describe('books catalog', () => {
  it('loads the on-device seed with titles and curated source labeling', () => {
    const snapshot = loadBooksCatalog();
    expect(snapshot.books.length).toBeGreaterThan(10);
    expect(snapshot.version.length).toBeGreaterThan(0);
    expect(snapshot.source).toBe('curated-seed');
    expect(snapshot.releaseLabel.length).toBeGreaterThan(0);
  });

  it('resolves a known slug and rejects garbage', () => {
    expect(getBookBySlug('the-bluest-eye')?.title).toMatch(/Bluest Eye/i);
    expect(getBookBySlug('not-a-real-book-slug-zzz')).toBeUndefined();
    expect(parseBookSlug('The-Bluest-Eye')).toBe('the-bluest-eye');
    expect(parseBookSlug('../evil')).toBeNull();
    expect(parseBookSlug('')).toBeNull();
  });

  it('filters by title and author', () => {
    const rows = listCatalogRows();
    const morrison = filterCatalogRows(rows, 'morrison');
    expect(morrison.length).toBeGreaterThan(0);
    expect(morrison.every((row) => /morrison/i.test(row.authorNames) || /morrison/i.test(row.title))).toBe(
      true,
    );
    expect(filterCatalogRows(rows, 'zzzz-no-match').length).toBe(0);
  });

  it('reports catalog pulse counts with source labeling', () => {
    const pulse = catalogPulse();
    expect(pulse.titleCount).toBe(loadBooksCatalog().books.length);
    expect(pulse.authorCount).toBeGreaterThan(0);
    expect(pulse.stateCount).toBeGreaterThan(0);
    expect(pulse.source).toBe('curated-seed');
    expect(pulse.releaseLabel.length).toBeGreaterThan(0);
  });

  it('strips em and en dashes from display copy', () => {
    expect(plainDashCopy('A—B')).toBe('A - B');
    expect(plainDashCopy('1920–1930')).toBe('1920 to 1930');
  });
});
