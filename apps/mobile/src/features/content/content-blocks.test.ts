/**
 * Malicious block corpus (MOB-015 requirement #2/#9). Feeds `normalizeContentPage` unknown block
 * types, deeply nested structures, and huge tables, asserting it degrades safely — skips/shows a
 * fallback — rather than crashing, hanging, or rendering arbitrary structure.
 */
import {
  MAX_BODY_SECTIONS,
  MAX_PARAGRAPHS_PER_SECTION,
  MAX_RELATED_IDS,
  normalizeContentPage,
} from './content-blocks';

const VALID_BASE = {
  slug: 'test-page',
  title: 'Test page',
  dek: 'A dek.',
  publishedAt: '2026-01-01',
  eraLabel: '2020s',
  placeLabel: 'Washington, D.C.',
  relatedEntityIds: [],
  relatedFactIds: [],
};

describe('normalizeContentPage — malicious block corpus', () => {
  it('round-trips a real, well-formed page', () => {
    const result = normalizeContentPage({
      ...VALID_BASE,
      body: [
        { heading: 'A heading', paragraphs: ['Paragraph one.', 'Paragraph two.'] },
        { paragraphs: ['No heading here.'] },
      ],
    });
    expect(result.page).not.toBeNull();
    expect(result.skippedSections).toBe(0);
    expect(result.blocks).toEqual([
      { kind: 'heading', text: 'A heading', level: 2 },
      { kind: 'paragraph', text: 'Paragraph one.' },
      { kind: 'paragraph', text: 'Paragraph two.' },
      { kind: 'paragraph', text: 'No heading here.' },
    ]);
  });

  it('rejects/skips an unrecognized block type instead of rendering it', () => {
    const result = normalizeContentPage({
      ...VALID_BASE,
      body: [
        { type: 'table', rows: [['a', 'b']] }, // unknown shape: no `paragraphs` array
        { type: 'callout', tone: 'warning', text: 'not a real block type' },
        { paragraphs: ['A real paragraph survives alongside the junk.'] },
      ],
    });
    expect(result.page).not.toBeNull();
    expect(result.skippedSections).toBe(2);
    expect(result.blocks).toEqual([
      { kind: 'paragraph', text: 'A real paragraph survives alongside the junk.' },
    ]);
  });

  it('does not crash or hang on a deeply nested structure standing in for a paragraph', () => {
    // Build a 10,000-level-deep nested object. If normalization ever recursed into "unknown
    // shape" looking for a string, this would blow the stack or take a very long time; instead
    // the paragraph-shape check is a single `typeof === 'string'` test, so this is dropped in
    // O(1) regardless of nesting depth.
    let deep: unknown = 'leaf';
    for (let i = 0; i < 10_000; i++) {
      deep = { child: deep };
    }
    const start = Date.now();
    const result = normalizeContentPage({
      ...VALID_BASE,
      body: [{ paragraphs: [deep] }, { paragraphs: ['A real paragraph.'] }],
    });
    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(1000);
    expect(result.page).not.toBeNull();
    expect(result.blocks).toEqual([{ kind: 'paragraph', text: 'A real paragraph.' }]);
  });

  it('does not crash when body itself is a deeply nested/self-referential-looking value', () => {
    const circular: Record<string, unknown> = { paragraphs: ['x'] };
    circular.self = circular;
    expect(() => normalizeContentPage({ ...VALID_BASE, body: [circular] })).not.toThrow();
  });

  it('caps an oversized body (maliciously large DTO) rather than allocating unbounded blocks', () => {
    const hugeBody = Array.from({ length: MAX_BODY_SECTIONS + 500 }, (_, i) => ({
      paragraphs: [`Section ${i}.`],
    }));
    const result = normalizeContentPage({ ...VALID_BASE, body: hugeBody });
    expect(result.page).not.toBeNull();
    expect(result.blocks.length).toBe(MAX_BODY_SECTIONS);
    expect(result.skippedSections).toBe(500);
  });

  it('caps an oversized paragraphs array within a single section', () => {
    const manyParagraphs = Array.from({ length: MAX_PARAGRAPHS_PER_SECTION + 1000 }, (_, i) => `p${i}`);
    const result = normalizeContentPage({ ...VALID_BASE, body: [{ paragraphs: manyParagraphs }] });
    expect(result.blocks.length).toBe(MAX_PARAGRAPHS_PER_SECTION);
  });

  it('renders a huge related-id table without hanging (bounded, not unbounded synchronous work)', () => {
    const hugeIds = Array.from({ length: 50_000 }, (_, i) => `ent_${i}`);
    const start = Date.now();
    const result = normalizeContentPage({ ...VALID_BASE, body: [], relatedEntityIds: hugeIds });
    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(1000);
    expect(result.page?.relatedEntityIds.length).toBe(MAX_RELATED_IDS);
  });

  it('rejects a section with only an empty paragraph (adversarial: hidden empty content)', () => {
    const result = normalizeContentPage({ ...VALID_BASE, body: [{ paragraphs: [''] }] });
    expect(result.blocks).toEqual([]);
    expect(result.skippedSections).toBe(1);
  });

  it('handles missing required top-level fields (malformed rich content) without crashing', () => {
    expect(normalizeContentPage({ body: [] }).page).toBeNull();
    expect(normalizeContentPage(null).page).toBeNull();
    expect(normalizeContentPage(undefined).page).toBeNull();
    expect(normalizeContentPage('a string, not an object').page).toBeNull();
    expect(normalizeContentPage(42).page).toBeNull();
    expect(normalizeContentPage([1, 2, 3]).page).toBeNull();
  });

  it('drops a non-string heading rather than rendering it', () => {
    const result = normalizeContentPage({
      ...VALID_BASE,
      body: [{ heading: { nested: 'object' }, paragraphs: ['still a paragraph'] }],
    });
    // The whole section is dropped since heading fails the bounded-string check.
    expect(result.skippedSections).toBe(1);
    expect(result.blocks).toEqual([]);
  });

  it('handles a body that is not an array at all', () => {
    const result = normalizeContentPage({ ...VALID_BASE, body: 'not an array' });
    expect(result.page).not.toBeNull();
    expect(result.blocks).toEqual([]);
    expect(result.skippedSections).toBe(0);
  });
});
