/**
 * Utility v6 page wiring: shared gutter mosaic, main landmark, no legacy mast.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));

const UTILITY_PAGES = [
  { route: 'locate', file: 'locate/page.tsx', seed: 'locate-edition-v6' },
  { route: 'submit', file: 'submit/page.tsx', seed: 'submit-edition-v6' },
  { route: 'corrections', file: 'corrections/page.tsx', seed: 'corrections-edition-v6' },
  { route: 'not-found', file: 'not-found.tsx', seed: 'not-found-edition-v6' },
  {
    route: 'error',
    file: 'error.tsx',
    seed: 'error-edition-v6',
    delegate: '../components/patterns/utility-edition/UtilityEditionErrorView.tsx',
  },
  {
    route: 'correction-status',
    file: 'corrections/status/[receiptCode]/page.tsx',
    seed: 'correction-status-edition-v6',
  },
] as const;

for (const page of UTILITY_PAGES) {
  test(`${page.route} uses UtilityEditionShell with mosaic and main landmark`, () => {
    const sourceFile =
      'delegate' in page ? join(appDir, page.delegate) : join(appDir, page.file);
    const source = readFileSync(sourceFile, 'utf8');
    assert.match(source, /UtilityEditionShell/);
    assert.match(source, /UtilityEditionIntro/);
    assert.match(source, new RegExp(page.seed));
    assert.match(source, /editionKey="/);
    assert.doesNotMatch(source, /ds-page__eyebrow/);
    assert.doesNotMatch(source, /ds-entity-mast/);
  });
}

test('not-found keeps archive recovery CTA', () => {
  const source = readFileSync(join(appDir, 'not-found.tsx'), 'utf8');
  assert.match(source, /Find in the archive/);
  assert.match(source, /href="\/history"/);
});
