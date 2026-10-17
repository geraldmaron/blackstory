/**
 * Tests for the research-case queue URL codec.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  caseQueryHref,
  defaultCaseStates,
  hasActiveCaseFilters,
  parseCaseQuery,
  serializeCaseQuery,
} from './case-query-params';

test('inbox defaults to the three triage states and serializes to an empty query', () => {
  const query = parseCaseQuery({}, 'inbox');
  assert.deepEqual(query.states, ['candidate', 'relevance_review', 'insufficient_evidence']);
  assert.equal(serializeCaseQuery(query, 'inbox'), '');
  assert.equal(hasActiveCaseFilters(query, 'inbox'), false);
});

test('cases defaults to no state filter', () => {
  const query = parseCaseQuery({}, 'cases');
  assert.equal(query.states, undefined);
  assert.deepEqual(defaultCaseStates('cases'), []);
  assert.equal(serializeCaseQuery(query, 'cases'), '');
});

test('round-trips filters, sort and paging', () => {
  const input = {
    q: 'greenwood',
    state: 'excluded,candidate',
    assignee: 'unassigned',
    sort: 'title',
    dir: 'asc',
    page: '3',
    size: '25',
  };
  const query = parseCaseQuery(input, 'cases');
  assert.deepEqual(query.states, ['excluded', 'candidate']);
  assert.equal(query.assignee, 'unassigned');
  assert.equal(query.pageSize, 25);
  const again = parseCaseQuery(
    Object.fromEntries(new URLSearchParams(serializeCaseQuery(query, 'cases'))),
    'cases',
  );
  assert.deepEqual(again, query);
  assert.equal(hasActiveCaseFilters(query, 'cases'), true);
});

test('unknown values fall back instead of reaching SQL', () => {
  const query = parseCaseQuery(
    { state: 'nope', sort: 'id; DROP TABLE', assignee: 'x', dir: 'sideways', page: '-4' },
    'cases',
  );
  assert.equal(query.states, undefined);
  assert.equal(query.sort, 'updated');
  assert.equal(query.assignee, 'any');
  assert.equal(query.direction, 'desc');
  assert.equal(query.page, 1);
});

test('any filter change resets to page one; a page change does not', () => {
  const query = parseCaseQuery({ page: '4', q: 'a' }, 'inbox');
  assert.equal(
    caseQueryHref('/admin/inbox', 'inbox', query, { sort: 'title' }),
    '/admin/inbox?q=a&sort=title',
  );
  assert.equal(
    caseQueryHref('/admin/inbox', 'inbox', query, { page: 5 }),
    '/admin/inbox?q=a&page=5',
  );
});
