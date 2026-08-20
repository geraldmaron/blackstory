/**
 * `extractChapterHeadings`: the single source of truth for both the heading elements'
 * anchor ids (ArticleBody) and the "In this chapter" rail nav (stories/[slug]/page.tsx).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HydratedArticleBlock } from './hydrate';
import { extractChapterHeadings } from './heading-anchors';

function heading(text: string, level: 2 | 3 = 2): HydratedArticleBlock {
  return { type: 'heading', level, text } as HydratedArticleBlock;
}

function paragraph(text: string): HydratedArticleBlock {
  return { type: 'paragraph', text } as HydratedArticleBlock;
}

test('collects only h2 headings, in reading order, with slugified ids', () => {
  const blocks = [
    heading('The count begins'),
    paragraph('...'),
    heading('A closer look', 3),
    heading('What changed after 1964'),
  ];
  const headings = extractChapterHeadings(blocks);
  assert.deepEqual(
    headings.map((h) => [h.id, h.text]),
    [
      ['the-count-begins', 'The count begins'],
      ['what-changed-after-1964', 'What changed after 1964'],
    ],
  );
});

test('carries the source block index, so ArticleBody can attach the same id to the element', () => {
  const blocks = [paragraph('...'), heading('Section one'), paragraph('...')];
  const headings = extractChapterHeadings(blocks);
  assert.equal(headings[0]?.blockIndex, 1);
});

test('two headings with the same text get distinct ids', () => {
  const blocks = [heading('The gap'), paragraph('...'), heading('The gap')];
  const headings = extractChapterHeadings(blocks);
  assert.deepEqual(
    headings.map((h) => h.id),
    ['the-gap', 'the-gap-2'],
  );
});

test('punctuation and apostrophes collapse into a clean slug', () => {
  const headings = extractChapterHeadings([heading("What it doesn't say — and why")]);
  assert.equal(headings[0]?.id, 'what-it-doesnt-say-and-why');
});

test('a heading with no alphanumeric content still gets a usable id', () => {
  const headings = extractChapterHeadings([heading('—')]);
  assert.equal(headings[0]?.id, 'section');
});

test('an article with no h2 headings returns an empty list, not a fallback item', () => {
  assert.deepEqual(extractChapterHeadings([paragraph('...'), heading('Aside', 3)]), []);
});
