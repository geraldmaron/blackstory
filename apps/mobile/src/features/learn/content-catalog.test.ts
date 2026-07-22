/**
 * Sanity/regression test: every bundled catalog entry must round-trip cleanly through the same
 * normalizer a hostile network payload would go through — catches a malformed seed-data edit
 * before it ships (e.g. an empty paragraph, an oversized field, a missing slug).
 */
import { normalizeTypedContentPage } from './content-blocks';
import { CONTENT_CATALOG, findCatalogEntry, listCatalogEntries } from './content-catalog';

describe('CONTENT_CATALOG', () => {
  it('has at least one entry', () => {
    expect(CONTENT_CATALOG.length).toBeGreaterThan(0);
  });

  it('every entry has a unique (section, slug) pair', () => {
    const seen = new Set<string>();
    for (const entry of CONTENT_CATALOG) {
      const key = `${entry.section}/${entry.page.slug}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('every entry normalizes with no skipped sections and at least one renderable block', () => {
    for (const entry of CONTENT_CATALOG) {
      const result = normalizeTypedContentPage(entry.page);
      expect(result.page).not.toBeNull();
      expect(result.skippedSections).toBe(0);
      expect(result.blocks.length).toBeGreaterThan(0);
    }
  });

  it('every requiresCitation entry actually carries at least one source (adversarial: missing citation on a claim-like block)', () => {
    for (const entry of CONTENT_CATALOG) {
      if (entry.requiresCitation) {
        expect(entry.sources && entry.sources.length > 0).toBe(true);
      }
    }
  });

  it('findCatalogEntry finds a known entry and returns undefined for an unknown slug', () => {
    expect(findCatalogEntry('legal', 'privacy')).toBeDefined();
    expect(findCatalogEntry('legal', 'not-a-real-slug')).toBeUndefined();
  });

  it('listCatalogEntries returns only entries for the requested section', () => {
    const legalEntries = listCatalogEntries('legal');
    expect(legalEntries.length).toBeGreaterThan(0);
    expect(legalEntries.every((entry) => entry.section === 'legal')).toBe(true);
  });
});
