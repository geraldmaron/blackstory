/**
 * The `figure` block in a story (docs/ui/DESIGN.md section 9.3): a block that names a registry
 * figure is drawn by the page's figure renderer on the wide track; any other figure block, and a
 * named figure that cannot be drawn, is the story's own packet chart. No published story names a
 * registry figure yet (the field is new in phase 6c), so this is a fixture.
 */
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { storyBodyBlockSchema } from '@repo/schemas';
import type { HydratedStory, HydratedStoryBlock } from '../../lib/stories/hydrate';
import { StoryBody, type StoryFigureRenderer } from './StoryBody';

void React;

const figure = (extra: object): HydratedStoryBlock =>
  ({
    type: 'figure',
    caption: 'Median family net worth, in 2022 dollars.',
    observations: [],
    sourceNumbers: [3],
    ...extra,
  }) as HydratedStoryBlock;

const story = (blocks: readonly HydratedStoryBlock[]) =>
  ({ blocks, refNumberById: new Map() }) as unknown as HydratedStory;

const seen: Parameters<StoryFigureRenderer>[0][] = [];
const renderFigure: StoryFigureRenderer = (embed) => {
  seen.push(embed);
  return embed.figureId === 'D-08' ? <section data-embed={embed.figureId} /> : undefined;
};

test('a block that names a registry figure is that figure, on the wide track, with its build date', () => {
  seen.length = 0;
  const markup = renderToStaticMarkup(
    <StoryBody
      story={story([figure({ figureId: 'D-08', figureAsOf: '2026-07-22T00:00:00.000Z' })])}
      renderFigure={renderFigure}
    />,
  );
  assert.match(markup, /<div class="ds-story-wide"><section data-embed="D-08">/);
  // The story's caption and its citation mark stay with the figure.
  assert.match(markup, /Median family net worth, in 2022 dollars\./);
  assert.doesNotMatch(markup, /ds-story-chart/);
  assert.equal(seen[0]!.figureId, 'D-08');
  assert.equal(seen[0]!.writtenAsOf, '2026-07-22T00:00:00.000Z');
  assert.ok(seen[0]!.fallback, 'the packet chart is handed over as the fallback');
});

test('a figure block with no registry figure, an unknown one, or no renderer is the packet chart', () => {
  const chart = /<figure class="ds-story-wide ds-story-chart">/;
  assert.match(
    renderToStaticMarkup(<StoryBody story={story([figure({})])} renderFigure={renderFigure} />),
    chart,
  );
  assert.match(
    renderToStaticMarkup(
      <StoryBody story={story([figure({ figureId: 'D-99' })])} renderFigure={renderFigure} />,
    ),
    chart,
  );
  assert.match(
    renderToStaticMarkup(<StoryBody story={story([figure({ figureId: 'D-08' })])} />),
    chart,
  );
});

test('the stored block keeps a figure id and its build date, and refuses a malformed id', () => {
  const block = { type: 'figure', packetId: 'wealth-q3', caption: 'Net worth.' };
  const parsed = storyBodyBlockSchema.parse({
    ...block,
    figureId: 'D-08',
    figureAsOf: '2026-07-22T00:00:00.000Z',
  });
  assert.deepEqual(
    [(parsed as { figureId?: string }).figureId, (parsed as { figureAsOf?: string }).figureAsOf],
    ['D-08', '2026-07-22T00:00:00.000Z'],
  );
  assert.equal(storyBodyBlockSchema.safeParse(block).success, true);
  assert.equal(storyBodyBlockSchema.safeParse({ ...block, figureId: 'wealth' }).success, false);
  assert.equal(storyBodyBlockSchema.safeParse({ ...block, figureAsOf: 'July' }).success, false);
});
