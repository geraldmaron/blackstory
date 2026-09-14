/**
 * Sanity/regression test: every bundled catalog entry must round-trip cleanly through the same
 * normalizer a hostile network payload would go through — catches a malformed seed-data edit
 * before it ships (e.g. an empty paragraph, an oversized field, a missing slug).
 */
import { isLegacyPath, semanticDestinationByPath } from '@repo/public-contracts/destinations';

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

  it('no bundled source points at a page that does not exist on blackstory.app', () => {
    // A source's href is an outward pointer readers will actually tap. If it names the web
    // origin, the path it points at must be a real destination (or a legacy alias that still
    // resolves) — not a page that was never built.
    for (const entry of CONTENT_CATALOG) {
      for (const source of entry.sources ?? []) {
        if (!source.href || !source.href.startsWith('https://blackstory.app/')) continue;
        const path = new URL(source.href).pathname;
        const isKnownDestination = Boolean(semanticDestinationByPath(path));
        const isKnownAlias = isLegacyPath(path);
        if (!isKnownDestination && !isKnownAlias) {
          throw new Error(
            `${entry.section}/${entry.page.slug} sources ${source.href}, which is neither a destination nor a legacy alias`,
          );
        }
      }
    }
  });

  it('Terms links to the real web notice, and only as a plain outward pointer', () => {
    const terms = findCatalogEntry('terms', 'terms');
    expect(terms).toBeDefined();
    // `apps/web/src/app/terms` now exists (TermsSections.tsx), so an outward source href is no
    // longer a false pointer — it is exactly the pattern privacy/methodology/faq/support already
    // use to cite their own fuller web page. The regression test above (no bundled source points
    // at a path that isn't a real destination) covers that `/terms` actually resolves.
    expect(terms?.sources?.some((source) => source.href === 'https://blackstory.app/terms')).toBe(
      true,
    );
    const bodyText = [
      terms?.page.dek ?? '',
      ...(terms?.page.body.flatMap((section) => section.paragraphs ?? []) ?? []),
    ]
      .join(' ')
      .toLowerCase();
    // What must NOT reappear is the old failure shape: the bundled copy claiming a fuller or more
    // authoritative document exists elsewhere, beyond the plain source link above. "web app" and
    // "full terms" were the old copy's own words for that claim; a link with a real destination
    // behind it is not the same thing as a body sentence promising one.
    expect(bodyText).not.toMatch(/web app/);
    expect(bodyText).not.toMatch(/full terms/);
  });

  it('findCatalogEntry finds a known entry and returns undefined for an unknown slug', () => {
    expect(findCatalogEntry('privacy', 'privacy')).toBeDefined();
    expect(findCatalogEntry('privacy', 'not-a-real-slug')).toBeUndefined();
  });

  it('carries a bundled FAQ and Support page, each with its web source attached', () => {
    // These were the two rows in native More with no screen of their own — tapping either opened
    // Safari. The condensed catalog entry is what `/faq` and `/support` now render.
    const faq = findCatalogEntry('faq', 'faq');
    const support = findCatalogEntry('support', 'support');
    expect(faq).toBeDefined();
    expect(faq?.sources?.some((source) => source.href === 'https://blackstory.app/faq')).toBe(true);
    expect(support).toBeDefined();
    expect(
      support?.sources?.some((source) => source.href === 'https://blackstory.app/support'),
    ).toBe(true);
  });

  it('listCatalogEntries returns only entries for the requested section', () => {
    const storyEntries = listCatalogEntries('stories');
    expect(storyEntries.length).toBeGreaterThan(0);
    expect(storyEntries.every((entry) => entry.section === 'stories')).toBe(true);
    // Privacy and Terms are their own sections now. "Legal" held both, and meant product policy
    // while `/law` meant historical statute — one word for two unrelated domains.
    expect(listCatalogEntries('privacy').length).toBe(1);
    expect(listCatalogEntries('terms').length).toBe(1);
    expect(listCatalogEntries('faq').length).toBe(1);
    expect(listCatalogEntries('support').length).toBe(1);
  });
});
