/**
 * Tests for Lives citation archive pointer helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { citationHref, withCitationArchiveUrl } from './lives-citation-archive';

test('withCitationArchiveUrl accepts only web.archive.org https pointers', () => {
  const citation = { label: 'Statute', url: 'https://www.govinfo.gov/statute.pdf' };
  const archived = withCitationArchiveUrl(
    citation,
    'https://web.archive.org/web/20200101000000/https://www.govinfo.gov/statute.pdf',
  );
  assert.equal(
    archived.archiveUrl,
    'https://web.archive.org/web/20200101000000/https://www.govinfo.gov/statute.pdf',
  );
  assert.throws(() => withCitationArchiveUrl(citation, 'https://evil.example/x'));
});

test('citationHref prefers the archive pointer when present', () => {
  const live = citationHref({ label: 'x', url: 'https://example.com/a' });
  assert.equal(live.archived, false);
  const archived = citationHref({
    label: 'x',
    url: 'https://example.com/a',
    archiveUrl: 'https://web.archive.org/web/20200101000000/https://example.com/a',
  });
  assert.equal(archived.archived, true);
  assert.equal(archived.href, 'https://web.archive.org/web/20200101000000/https://example.com/a');
});
