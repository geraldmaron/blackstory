/**
 * `headingAnchorId` and `chapterToc`: the anchor-id scheme the "In this chapter" rail and the
 * headings it points at both depend on. The one thing that must never happen is the two
 * disagreeing about an id — a rail link that 404s within its own page.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chapterToc, headingAnchorId } from './ArticleBody';
import type { HydratedArticle, HydratedArticleBlock } from '../../lib/articles/hydrate';

function article(blocks: readonly HydratedArticleBlock[]): HydratedArticle {
  return {
    doc: {} as HydratedArticle['doc'],
    blocks,
    references: [],
    refNumberById: new Map(),
  };
}

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

test('chapterToc lists only level-2 headings, in reading order, with matching ids', () => {
  const doc = article([
    { type: 'heading', level: 2, text: 'Before the ordinance' },
    { type: 'paragraph', text: 'Some prose.' },
    { type: 'heading', level: 3, text: 'A subsection, not in the TOC' },
    { type: 'heading', level: 2, text: 'After the ordinance' },
  ]);
  const toc = chapterToc(doc);
  assert.deepEqual(
    toc.map((entry) => entry.text),
    ['Before the ordinance', 'After the ordinance'],
  );
  assert.equal(toc[0]?.id, headingAnchorId(0, 'Before the ordinance'));
  assert.equal(toc[1]?.id, headingAnchorId(3, 'After the ordinance'));
});

test('an article with no level-2 headings has an empty table of contents', () => {
  const doc = article([{ type: 'paragraph', text: 'No headings here.' }]);
  assert.deepEqual(chapterToc(doc), []);
});
