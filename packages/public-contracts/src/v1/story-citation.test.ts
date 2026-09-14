import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_CITING_STORIES,
  citingStoriesV1Schema,
  storyCitationV1Schema,
} from './story-citation.js';

test('round-trips a story citation', () => {
  const input = {
    slug: 'blockbusting',
    title: 'Blockbusting',
    relation: 'mapped in',
    href: '/stories/blockbusting',
  };
  assert.deepEqual(storyCitationV1Schema.parse(input), input);
});

test('relation is a phrase a reader can read, not a slug the client branches on', () => {
  const parsed = storyCitationV1Schema.parse({
    slug: 'zoning',
    title: 'Zoning',
    relation: 'referenced in',
    href: '/stories/zoning',
  });
  assert.equal(parsed.relation, 'referenced in');
  assert.throws(() =>
    storyCitationV1Schema.parse({
      slug: 'zoning',
      title: 'Zoning',
      relation: '',
      href: '/stories/zoning',
    }),
  );
});

test('the citing list is bounded (adversarial: unbounded list on one record)', () => {
  const one = {
    slug: 'a',
    title: 'A',
    relation: 'referenced in',
    href: '/stories/a',
  };
  assert.equal(
    citingStoriesV1Schema.parse(Array.from({ length: MAX_CITING_STORIES }, () => one)).length,
    MAX_CITING_STORIES,
  );
  assert.throws(() =>
    citingStoriesV1Schema.parse(Array.from({ length: MAX_CITING_STORIES + 1 }, () => one)),
  );
});
