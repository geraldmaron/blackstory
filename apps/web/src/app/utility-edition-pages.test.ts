/** Utility page wiring: each of these pages renders through the shared page kit. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));

const PAGE_KIT_PAGES = [
  { route: 'submit', file: 'submit/page.tsx' },
  { route: 'corrections', file: 'corrections/page.tsx' },
  { route: 'support', file: 'support/page.tsx' },
  { route: 'privacy', file: 'privacy/page.tsx' },
  { route: 'not-found', file: 'not-found.tsx' },
  { route: 'error', file: 'error.tsx' },
  { route: 'correction-status', file: 'corrections/status/[receiptCode]/page.tsx' },
] as const;

for (const page of PAGE_KIT_PAGES) {
  test(`${page.route} renders through the page kit`, () => {
    const source = readFileSync(join(appDir, page.file), 'utf8');
    // Depth-agnostic: these rooms sit anywhere from the app root (`not-found.tsx`) to four
    // levels down (`corrections/status/[receiptCode]`), so pinning the `../` count would fail
    // a correct conversion for the wrong reason.
    assert.match(source, /from '(?:\.\.\/)+components\/page(?:'|\/(?:PageFrame)')/);
    assert.match(source, /<PageFrame/);
    assert.match(source, /<PageHeader/);
    // Trust pages and forms open on a color mast with a paper sheet risen over it, so they take
    // the wide container and the sheet sets the reading measure; the error pages stay read.
    const width = page.route === 'not-found' || page.route === 'error' ? 'read' : 'wide';
    assert.match(source, new RegExp(`<PageFrame\\s+width="${width}"`));
    if (width === 'wide') {
      assert.match(source, /<TrustMast/);
      assert.match(source, /<TrustSheet>/);
    }
    // The v6 shell must be gone rather than merely unused: two chromes on one page is the drift
    // the kit exists to remove, and an unused import is how the second one comes back.
    assert.doesNotMatch(source, /UtilityEditionShell/);
    assert.doesNotMatch(source, /UtilityEditionIntro/);
    assert.doesNotMatch(source, /EditionAtmosphereMosaic/);
  });
}

test('not-found is one sentence and the way back, with no gallery exit', () => {
  const source = readFileSync(join(appDir, 'not-found.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(source, /<Button href="\/">Back to the front page<\/Button>/);
  // The second way on is the archive's own search, which a redirect never stands in for.
  assert.match(source, /href="\/archive"/);
  // The `/design-system` exit sent a reader who mistyped a story slug to a component gallery.
  assert.doesNotMatch(source, /design-system/);
  assert.doesNotMatch(source, /ds-utility-exits|BandArt|DisplayNumeral/);
});

test('not-found seeds the bar search with the path it was reached by', () => {
  const source = readFileSync(join(appDir, 'not-found.tsx'), 'utf8');
  assert.match(source, /<PaletteSeed \/>/);
  assert.match(source, /from '\.\.\/components\/shell\/PaletteSeed'/);
});
