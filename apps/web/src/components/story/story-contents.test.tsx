/**
 * StoryContents: one heading source, two placements. Ids never repeat, every target is the exact
 * id extractChapterHeadings gave the h2, and a chapter without h2 headings renders no contents.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { extractChapterHeadings } from '../../lib/stories/heading-anchors';
import type { HydratedStoryBlock } from '../../lib/stories/hydrate';
import { StoryContents } from './story-contents';

void React;

const blocks = [
  { type: 'heading', level: 2, text: 'The ordinance' },
  { type: 'heading', level: 3, text: 'A subsection' },
  { type: 'heading', level: 2, text: 'The ordinance' },
  { type: 'heading', level: 2, text: "Owners' answer" },
] as unknown as readonly HydratedStoryBlock[];

const headings = extractChapterHeadings(blocks);

function both(list = headings): string {
  return (
    renderToStaticMarkup(<StoryContents headings={list} noun="chapter" variant="inline" />) +
    renderToStaticMarkup(<StoryContents headings={list} noun="chapter" variant="rail" />)
  );
}

describe('StoryContents', () => {
  it('links every h2 by the exact id extractChapterHeadings assigned, in both placements', () => {
    assert.deepEqual(
      headings.map((heading) => heading.id),
      ['the-ordinance', 'the-ordinance-2', 'owners-answer'],
    );
    const markup = both();
    for (const heading of headings) {
      assert.equal(markup.split(`href="#${heading.id}"`).length - 1, 2, heading.id);
    }
    assert.ok(!markup.includes('A subsection'), 'h3 subsections are not in the contents');
  });

  it('renders a native details/summary inline and the unchanged rail group', () => {
    const inline = renderToStaticMarkup(
      <StoryContents headings={headings} noun="chapter" variant="inline" />,
    );
    assert.match(inline, /^<details class="ds-reading-toc" id="story-toc-inline"><summary/);
    assert.match(inline, /<nav aria-label="In this chapter">/);
    assert.match(inline, /3 sections/);
    assert.ok(!inline.includes(' open'), 'collapsed by default');
    const rail = renderToStaticMarkup(
      <StoryContents headings={headings} noun="chapter" variant="rail" />,
    );
    assert.match(
      rail,
      /<nav class="ds-room-rail-group ds-reading-toc-rail" aria-labelledby="story-toc">/,
    );
    assert.match(rail, /<p class="ds-room-rail-group__title" id="story-toc">In this chapter<\/p>/);
  });

  it('never repeats a DOM id across the two placements', () => {
    const ids = [...both().matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids.sort(), ['story-toc', 'story-toc-inline']);
  });

  it('uses the page noun', () => {
    const entry = renderToStaticMarkup(
      <StoryContents headings={headings} noun="entry" variant="inline" />,
    );
    assert.match(entry, /In this entry/);
  });

  it('omits both placements when the chapter has no h2 headings', () => {
    const none = extractChapterHeadings([
      { type: 'heading', level: 3, text: 'Only a subsection' },
    ] as unknown as readonly HydratedStoryBlock[]);
    assert.equal(both(none), '');
  });
});

describe('StoryContents css contract', () => {
  const css = readFileSync(new URL('./story.css', import.meta.url), 'utf8');

  it('hides inline contents by default and swaps both placements at the existing rail breakpoint', () => {
    assert.match(css, /\.ds-reading-toc \{\s*display: none;/);
    assert.match(css, /@media \(max-width: 68rem\) \{\s*\.ds-reading-toc \{\s*display: block;/);
    assert.match(css, /\.ds-room-rail-group\.ds-reading-toc-rail \{\s*display: none;/);
    assert.ok(!css.includes('67.9375rem'));
  });

  it('keeps standalone targets at 44px and focus visible', () => {
    assert.match(css, /--ds-reading-target: 2\.75rem/);
    assert.match(css, /\.ds-reading-toc__link \{[^}]*min-height: var\(--ds-reading-target\)/);
    assert.match(css, /\.ds-reading-toc__summary:focus-visible/);
  });
});

describe('page integration', () => {
  const page = readFileSync(new URL('../../app/stories/[slug]/page.tsx', import.meta.url), 'utf8');

  it('mounts the inline contents before StoryBody and no second ReadingProgress', () => {
    assert.ok(page.indexOf('variant="inline"') < page.indexOf('<StoryBody story={story} />'));
    assert.ok(!page.includes('ReadingProgress'));
  });

  it('labels the byline count as References and keeps the about-this-chapter target', () => {
    assert.match(
      page,
      /<a href="#about-this-chapter">References \(\{story\.references\.length\}\)<\/a>/,
    );
    assert.ok(!page.includes('records</a>'));
  });
});
