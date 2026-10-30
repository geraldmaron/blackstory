/**
 * Queue URL codec: parsing, round-tripping, rejection of unknown values, and where rows open.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hasActiveQueueFilters,
  parseQueueQuery,
  queueQueryHref,
  queueRowHref,
  serializeQueueQuery,
  toggleQueueFacetHref,
} from './queue-query.js';

test('defaults are page 1 with no filters', () => {
  const query = parseQueueQuery({});
  assert.equal(query.page, 1);
  assert.equal(hasActiveQueueFilters(query), false);
  assert.equal(serializeQueueQuery(query), '');
});

test('filters round-trip and unknown values never reach SQL', () => {
  const query = parseQueueQuery({
    type: 'case,packet,bogus',
    stage: 'triage,stuck;drop',
    age: 'over_90d',
    assignee: 'unassigned',
    q: ' Selma ',
  });
  assert.deepEqual(query.types, ['case', 'packet']);
  assert.deepEqual(query.stages, ['triage']);
  assert.deepEqual(query.ageBands, ['over_90d']);
  assert.equal(query.assignee, 'unassigned');
  assert.equal(query.search, 'Selma');
  assert.deepEqual(
    parseQueueQuery(Object.fromEntries(new URLSearchParams(serializeQueueQuery(query)))),
    {
      ...query,
    },
  );
  assert.equal(parseQueueQuery({ assignee: 'someone' }).assignee, undefined);
});

test('a filter change resets the page; a page change does not', () => {
  const query = parseQueueQuery({ page: '4', type: 'case' });
  assert.equal(
    queueQueryHref('/admin/queue', query, { stages: ['triage'] }),
    '/admin/queue?type=case&stage=triage',
  );
  assert.equal(queueQueryHref('/admin/queue', query, { page: 5 }), '/admin/queue?type=case&page=5');
  assert.equal(toggleQueueFacetHref('/admin/queue', query, 'types', 'case'), '/admin/queue');
});

test('each row type opens its own decision page, with the id encoded', () => {
  assert.equal(queueRowHref('case', 'abc'), '/admin/cases/abc');
  assert.equal(queueRowHref('lead', 'a b'), '/admin/submissions/a%20b');
  assert.equal(queueRowHref('packet', 'p1'), '/admin/stories/review/p1');
  assert.equal(queueRowHref('request', 'w1'), '/admin/work/w1');
});
