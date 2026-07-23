/**
 * Search route redirect contract: /search merged into unified /history surface.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { mapSearchQueryToHistoryHref } from '../../lib/history/search-redirect';

const here = dirname(fileURLToPath(import.meta.url));
const searchPageTsx = readFileSync(join(here, 'page.tsx'), 'utf8');

describe('/search redirect', () => {
  it('page.tsx redirects through mapSearchQueryToHistoryHref', () => {
    assert.match(searchPageTsx, /redirect\(mapSearchQueryToHistoryHref/);
    assert.doesNotMatch(searchPageTsx, /SearchBrowseSections/);
  });

  it('maps legacy search URLs onto history with facets preserved', () => {
    assert.equal(
      mapSearchQueryToHistoryHref({ q: 'obama', kind: 'place', status: 'historic', era: '1960s' }),
      '/history?q=obama&kind=place&status=historic&era=1960s',
    );
  });
});
