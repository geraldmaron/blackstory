import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeLinkInput } from './link';

test('https addresses pass, bare domains get https, everything else says why not', () => {
  assert.deepEqual(normalizeLinkInput(' https://www.loc.gov/item/1 '), {
    href: 'https://www.loc.gov/item/1',
  });
  assert.deepEqual(normalizeLinkInput('example.org/page?x=1'), {
    href: 'https://example.org/page?x=1',
  });
  for (const bad of [
    '',
    'http://example.org',
    'javascript:alert(1)',
    'mailto:a@b.org',
    'two words',
    'https://user:pw@example.org/',
  ]) {
    assert.ok('problem' in normalizeLinkInput(bad), bad);
  }
});
