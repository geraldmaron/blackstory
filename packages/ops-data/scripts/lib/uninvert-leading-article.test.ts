import assert from 'node:assert/strict';
import { test } from 'node:test';
import { uninvertLeadingArticle } from './uninvert-leading-article.ts';

test('moves a trailing article to the front', () => {
  assert.equal(uninvertLeadingArticle("Women's Building, The"), "The Women's Building");
  assert.equal(uninvertLeadingArticle('Omaha Star, the'), 'The Omaha Star');
  assert.equal(uninvertLeadingArticle('Grange, A'), 'A Grange');
});

test('leaves other names alone', () => {
  assert.equal(uninvertLeadingArticle('Smith, John, House'), 'Smith, John, House');
  assert.equal(uninvertLeadingArticle('The Grange'), 'The Grange');
  assert.equal(uninvertLeadingArticle('Hotel Theresa'), 'Hotel Theresa');
});
