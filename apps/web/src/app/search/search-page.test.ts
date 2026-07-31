/**
 * `/search` route contract: a redirect endpoint that resolves to `/records` in one hop.
 *
 * The href mapping itself is covered by `lib/redirects/redirect-table.test.ts` alongside the
 * chain guarantee, so this file only asserts the route is wired to it and renders nothing.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { mapSearchQueryToRecordsHref } from '../../lib/search/search-href';

const here = dirname(fileURLToPath(import.meta.url));
const searchPageTsx = readFileSync(join(here, 'page.tsx'), 'utf8');

describe('/search redirect', () => {
  it('page.tsx permanently redirects through mapSearchQueryToRecordsHref', () => {
    // permanentRedirect, not redirect: a 307 would keep /search indexed as a real surface.
    assert.match(searchPageTsx, /permanentRedirect\(mapSearchQueryToRecordsHref/);
    assert.doesNotMatch(searchPageTsx, /SearchBrowseSections/);
  });

  it('lands on /records rather than routing through /history', () => {
    assert.equal(
      mapSearchQueryToRecordsHref({
        q: 'obama',
        kind: 'place',
        status: 'historic',
        era: '1960s',
      }),
      '/records?q=obama&kind=place&status=historic&era=1960s',
    );
  });
});
