/**
 * Workbench URL-state codec: parsing, round-tripping, and the page-reset rule.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  entityQueryHref,
  hasActiveFilters,
  parseEntityQuery,
  serializeEntityQuery,
  toggleFacetHref,
} from './entity-query-params.js';

test('defaults hide absorbed merge tombstones and sort by recency', () => {
  const query = parseEntityQuery({});
  assert.equal(query.mergeState, 'active');
  assert.equal(query.sort, 'updated');
  assert.equal(query.direction, 'desc');
  assert.equal(query.page, 1);
});

test('multi-value facets accept comma and repeated forms and de-duplicate', () => {
  assert.deepEqual(parseEntityQuery({ kind: 'person,place' }).kinds, ['person', 'place']);
  assert.deepEqual(parseEntityQuery({ kind: ['person', 'place'] }).kinds, ['person', 'place']);
  assert.deepEqual(parseEntityQuery({ kind: 'person,person, place ' }).kinds, ['person', 'place']);
});

test('name and kind sorts default ascending; recency and counts default descending', () => {
  assert.equal(parseEntityQuery({ sort: 'name' }).direction, 'asc');
  assert.equal(parseEntityQuery({ sort: 'kind' }).direction, 'asc');
  assert.equal(parseEntityQuery({ sort: 'claims' }).direction, 'desc');
  assert.equal(parseEntityQuery({ sort: 'name', dir: 'desc' }).direction, 'desc');
});

test('unknown sort, direction, merge state, and living status fall back instead of reaching SQL', () => {
  const query = parseEntityQuery({
    sort: 'id; drop table entities',
    dir: 'sideways',
    merge: 'nope',
    living: 'living,bogus',
    page: '-4',
  });
  assert.equal(query.sort, 'updated');
  assert.equal(query.direction, 'desc');
  assert.equal(query.mergeState, 'active');
  assert.deepEqual(query.livingStatuses, ['living']);
  assert.equal(query.page, 1);
});

test('not_applicable is a valid living status', () => {
  // 3,623 of 4,097 rows carry it; the previous reader dropped it and blanked the column.
  assert.deepEqual(parseEntityQuery({ living: 'not_applicable' }).livingStatuses, [
    'not_applicable',
  ]);
});

test('page size is clamped to the query layer bounds', () => {
  assert.equal(parseEntityQuery({ size: '5000' }).pageSize, 200);
  assert.equal(parseEntityQuery({ size: '0' }).pageSize, 50);
});

test('a default view serializes to an empty query string', () => {
  assert.equal(serializeEntityQuery(parseEntityQuery({})), '');
});

test('a filtered view round-trips through serialize and parse', () => {
  const original = parseEntityQuery({
    q: 'attucks',
    kind: 'person,event',
    class: 'person',
    living: 'deceased',
    sensitivity: 'violence_associated',
    noclaims: '1',
    merge: 'all',
    sort: 'claims',
    dir: 'asc',
    page: '3',
    size: '100',
  });
  const reparsed = parseEntityQuery(
    Object.fromEntries(new URLSearchParams(serializeEntityQuery(original))),
  );
  assert.deepEqual(reparsed, original);
});

test('changing a filter resets to page 1, but paging does not', () => {
  const query = parseEntityQuery({ page: '7', kind: 'place' });
  assert.match(toggleFacetHref('/catalog', query, 'kinds', 'person'), /kind=place%2Cperson/);
  assert.doesNotMatch(toggleFacetHref('/catalog', query, 'kinds', 'person'), /page=/);
  assert.match(entityQueryHref('/catalog', query, { page: 8 }), /page=8/);
});

test('toggling an active facet value removes it', () => {
  const query = parseEntityQuery({ kind: 'person,place' });
  assert.match(toggleFacetHref('/catalog', query, 'kinds', 'person'), /kind=place/);
});

test('hasActiveFilters ignores defaults but sees every real narrowing', () => {
  assert.equal(hasActiveFilters(parseEntityQuery({})), false);
  assert.equal(hasActiveFilters(parseEntityQuery({ page: '4', sort: 'name' })), false);
  assert.equal(hasActiveFilters(parseEntityQuery({ q: 'ball' })), true);
  assert.equal(hasActiveFilters(parseEntityQuery({ merge: 'absorbed' })), true);
  assert.equal(hasActiveFilters(parseEntityQuery({ noclaims: '1' })), true);
});
