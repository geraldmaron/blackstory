/**
 * Submissions queue URL-state codec: parsing, round-tripping, and the page-reset rule.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hasActiveSubmissionFilters,
  parseSubmissionQuery,
  serializeSubmissionQuery,
  submissionQueryHref,
  toggleSubmissionFacetHref,
} from './submission-query-params.js';

test('defaults to the actionable (quarantined) queue, newest first', () => {
  const query = parseSubmissionQuery({});
  assert.deepEqual(query.statuses, ['quarantined']);
  assert.equal(query.direction, 'desc');
  assert.equal(query.page, 1);
});

test('an unknown status is dropped, and an empty result falls back to the default queue', () => {
  assert.deepEqual(parseSubmissionQuery({ status: 'bogus' }).statuses, ['quarantined']);
  assert.deepEqual(parseSubmissionQuery({ status: 'promoted,bogus' }).statuses, ['promoted']);
});

test('multi-value facets accept comma and repeated forms and de-duplicate', () => {
  assert.deepEqual(parseSubmissionQuery({ kind: 'lead,discovery_survivor' }).kinds, [
    'lead',
    'discovery_survivor',
  ]);
  assert.deepEqual(parseSubmissionQuery({ kind: ['lead', 'lead'] }).kinds, ['lead']);
});

test('unknown direction and non-positive page fall back instead of reaching SQL', () => {
  const query = parseSubmissionQuery({ dir: 'sideways', page: '-4' });
  assert.equal(query.direction, 'desc');
  assert.equal(query.page, 1);
});

test('page size is clamped to the query layer bounds', () => {
  assert.equal(parseSubmissionQuery({ size: '5000' }).pageSize, 200);
  assert.equal(parseSubmissionQuery({ size: '0' }).pageSize, 50);
});

test('the default queue serializes to an empty query string', () => {
  assert.equal(serializeSubmissionQuery(parseSubmissionQuery({})), '');
});

test('a filtered view round-trips through serialize and parse', () => {
  const original = parseSubmissionQuery({
    q: 'attucks',
    status: 'promoted,rejected',
    kind: 'lead',
    dir: 'asc',
    page: '3',
    size: '100',
  });
  const reparsed = parseSubmissionQuery(
    Object.fromEntries(new URLSearchParams(serializeSubmissionQuery(original))),
  );
  assert.deepEqual(reparsed, original);
});

test('switching to all four statuses is a real filter change, not the default', () => {
  const query = parseSubmissionQuery({ status: 'quarantined,promoted,rejected,spam' });
  assert.equal(hasActiveSubmissionFilters(query), true);
  assert.match(serializeSubmissionQuery(query), /status=quarantined%2Cpromoted%2Crejected%2Cspam/);
});

test('changing a filter resets to page 1, but paging does not', () => {
  const query = parseSubmissionQuery({ page: '7', status: 'rejected' });
  assert.match(
    toggleSubmissionFacetHref('/admin/submissions', query, 'kinds', 'lead'),
    /kind=lead/,
  );
  assert.doesNotMatch(
    toggleSubmissionFacetHref('/admin/submissions', query, 'kinds', 'lead'),
    /page=/,
  );
  assert.match(submissionQueryHref('/admin/submissions', query, { page: 8 }), /page=8/);
});

test('toggling an active facet value removes it', () => {
  const query = parseSubmissionQuery({ status: 'promoted,rejected' });
  assert.match(
    toggleSubmissionFacetHref('/admin/submissions', query, 'statuses', 'promoted'),
    /status=rejected/,
  );
});

test('hasActiveSubmissionFilters ignores defaults but sees every real narrowing', () => {
  assert.equal(hasActiveSubmissionFilters(parseSubmissionQuery({})), false);
  assert.equal(hasActiveSubmissionFilters(parseSubmissionQuery({ page: '4' })), false);
  assert.equal(hasActiveSubmissionFilters(parseSubmissionQuery({ q: 'ball' })), true);
  assert.equal(hasActiveSubmissionFilters(parseSubmissionQuery({ status: 'promoted' })), true);
  assert.equal(hasActiveSubmissionFilters(parseSubmissionQuery({ kind: 'lead' })), true);
});
