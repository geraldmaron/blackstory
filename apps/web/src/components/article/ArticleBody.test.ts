/**
 * `headingAnchorId`: the anchor-id scheme h3 subheadings use. h2 section headings get their id
 * from `extractChapterHeadings` instead (see heading-anchors.test.ts) — the same function the
 * rail's "In this chapter" nav reads, so the two can never disagree about an id.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { headingAnchorId } from './ArticleBody';

test('the id is stable and readable: index prefix plus a slug of the text', () => {
  assert.equal(headingAnchorId(2, 'The ordinance and its afterlife'), 'section-2-the-ordinance-and-its-afterlife');
});

test('non-alphanumeric characters collapse to single hyphens, trimmed at the edges', () => {
  assert.equal(headingAnchorId(0, '  1926: "Redlining," Revisited!  '), 'section-0-1926-redlining-revisited');
});

test('a heading with nothing sluggable still gets a usable id from its index alone', () => {
  assert.equal(headingAnchorId(5, '§§§'), 'section-5');
});

test('two different headings at different indices never collide, even with identical text', () => {
  const a = headingAnchorId(1, 'Aftermath');
  const b = headingAnchorId(4, 'Aftermath');
  assert.notEqual(a, b);
});
