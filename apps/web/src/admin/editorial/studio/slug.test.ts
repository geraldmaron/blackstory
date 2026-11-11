import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { slugifyTitle, uniqueSlug } from './slug';

describe('slugifyTitle', () => {
  it('lowercases, strips diacritics and collapses punctuation', () => {
    assert.equal(
      slugifyTitle('  Café Society: Harlem’s “Renaissance”!  '),
      'cafe-society-harlems-renaissance',
    );
  });
  it('caps at 80 characters without a trailing hyphen', () => {
    const slug = slugifyTitle(`${'word '.repeat(30)}end`);
    assert.ok(slug.length <= 80);
    assert.ok(!slug.endsWith('-'));
  });
  it('never returns the create route', () => {
    assert.equal(slugifyTitle('New'), '');
    assert.equal(slugifyTitle('!!!'), '');
    assert.equal(slugifyTitle('Freedom’s First Ballot'), 'freedoms-first-ballot');
    assert.equal(slugifyTitle("Ida's Paper"), 'idas-paper');
  });
});

describe('uniqueSlug', () => {
  it('suffixes until free', () => {
    assert.equal(uniqueSlug('a', new Set(['a', 'a-2'])), 'a-3');
    assert.equal(uniqueSlug('a', new Set()), 'a');
    assert.equal(uniqueSlug('', new Set(['a'])), '');
  });
});
