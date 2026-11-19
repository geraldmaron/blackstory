import assert from 'node:assert/strict';
import { test } from 'node:test';
import { storyPath } from '../destinations.js';
import { storyRunV1Schema, storyV1Schema, storiesResponseV1Schema } from './story.js';

const base = {
  slug: 'abraham-lincoln',
  title: 'Abraham Lincoln',
  summary: 'Lincoln signed the District of Columbia Compensated Emancipation Act.',
  format: 'entry' as const,
  eraLabel: '1861–1865',
  placeLabel: 'United States',
  publishedAt: '2026-08-07',
  collection: { id: 'presidents', label: 'The presidents on the record', position: 16 },
  webPath: storyPath('abraham-lincoln', 'presidents'),
};

test('a president lives under /presidents; a chapter under /stories', () => {
  assert.equal(storyPath('abraham-lincoln', 'presidents'), '/presidents/abraham-lincoln');
  assert.equal(storyPath('buying-a-home'), '/stories/buying-a-home');
  assert.equal(storyPath('part-one', 'some-series'), '/stories/part-one');
});

test('a story with runs, a list, a web-only block and sources parses', () => {
  const story = storyV1Schema.parse({
    ...base,
    releaseId: 'rel_1',
    body: [
      { type: 'heading', level: 2, text: 'The record' },
      {
        type: 'paragraph',
        runs: [
          { t: 'text', text: 'Signed ' },
          { t: 'text', text: 'the act', strong: true },
          { t: 'cite', n: 1, refId: 'nara-dc' },
        ],
      },
      { type: 'list', style: 'bullet', items: [[{ t: 'text', text: 'One' }]] },
      { type: 'webOnly', kind: 'figure', caption: 'Wealth per person' },
      { type: 'record', entityId: 'ent_1', label: 'Greenwood' },
    ],
    references: [{ id: 'nara-dc', label: 'National Archives', url: 'https://www.archives.gov/x' }],
    contributors: [{ name: 'Neo', kind: 'editorial', roles: ['author'] }],
  });
  assert.equal(story.body.length, 5);
  assert.ok(storiesResponseV1Schema.parse({ releaseId: 'rel_1', stories: [base] }));
});

test('unsafe links and unbounded text are rejected', () => {
  assert.equal(
    storyRunV1Schema.safeParse({ t: 'text', text: 'x', href: 'javascript:alert(1)' }).success,
    false,
  );
  assert.equal(
    storyV1Schema.safeParse({
      ...base,
      slug: '../etc',
      releaseId: 'r',
      body: [],
      references: [],
      contributors: [],
    }).success,
    false,
  );
});
