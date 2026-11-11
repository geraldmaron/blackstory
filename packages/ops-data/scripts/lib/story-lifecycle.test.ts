import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countProseWords, validateStoryOffline, type StoryAuthoring } from './story-lifecycle.ts';

const story = (status: StoryAuthoring['status'], text: string): StoryAuthoring =>
  ({
    id: 's1',
    slug: 's1',
    format: 'entry',
    title: 't',
    summary: 's',
    publishedAt: '2026-01-01',
    eraLabel: 'e',
    placeLabel: 'p',
    tags: [],
    status,
    body: [
      { type: 'paragraph', text },
      { type: 'table', caption: 'cap', header: true, rows: [['a', 'b']] },
    ],
    references: [],
    relatedEntityIds: [],
    contributors: [],
  }) as StoryAuthoring;

test('an unsafe external link fails a published story and only warns on a draft', () => {
  const bad = 'See [the act](http://example.org/a) for more.';
  assert.throws(() => validateStoryOffline(story('published', bad)), /external link gate/);
  assert.doesNotThrow(() => validateStoryOffline(story('draft', bad)));
  assert.doesNotThrow(() =>
    validateStoryOffline(story('published', 'See [the act](https://example.org/a).')),
  );
});

test('word count sees visible words only: labels kept, citations and marks dropped', () => {
  assert.equal(countProseWords(story('draft', '**One** [[e|Two Three]][ref:a] four.')), 4);
});
