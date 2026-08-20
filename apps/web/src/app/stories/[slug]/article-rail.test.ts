import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicArticleListItemDoc } from '@repo/schemas';
import { nextInCollection } from './article-rail';

function item(overrides: Partial<PublicArticleListItemDoc>): PublicArticleListItemDoc {
  return {
    id: overrides.id ?? 'a1',
    releaseId: 'rel-1',
    slug: overrides.slug ?? 'a-chapter',
    kind: overrides.kind ?? 'chapter',
    title: overrides.title ?? 'A chapter',
    summary: overrides.summary ?? 'A summary long enough to pass validation.',
    publishedAt: overrides.publishedAt ?? '2020-01-01',
    eraLabel: overrides.eraLabel ?? 'Redlining',
    placeLabel: overrides.placeLabel ?? 'Tulsa, Oklahoma',
    tags: overrides.tags ?? [],
    ...overrides,
  };
}

const collection = [
  item({
    id: 'p1',
    slug: 'p1',
    title: 'First',
    series: { id: 'presidents', label: 'Presidential records', position: 1 },
  }),
  item({
    id: 'p2',
    slug: 'p2',
    title: 'Second',
    series: {
      id: 'presidents',
      label: 'Presidential records',
      position: 2,
      positionLabel: '2nd president',
    },
  }),
  item({
    id: 'p3',
    slug: 'p3',
    title: 'Third',
    series: { id: 'presidents', label: 'Presidential records', position: 3 },
  }),
];

test('finds the next entry by series position', () => {
  const next = nextInCollection('presidents', 1, 'p1', collection);
  assert.deepEqual(next, { href: '/stories/p2', title: 'Second', positionLabel: '2nd president' });
});

test('undefined for the last entry in a collection', () => {
  assert.equal(nextInCollection('presidents', 3, 'p3', collection), undefined);
});

test('undefined when the article carries no series', () => {
  assert.equal(nextInCollection(undefined, undefined, 'solo', collection), undefined);
});

test('skips a gap and finds the nearest later position, not just any later one', () => {
  const withGap = [...collection];
  const next = nextInCollection('presidents', 1, 'p1', withGap);
  assert.equal(next?.title, 'Second');
});

test('never returns the article about itself, even if data duplicated its own slug', () => {
  const next = nextInCollection('presidents', 2, 'p2', collection);
  assert.equal(next?.title, 'Third');
});
