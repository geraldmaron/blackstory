/**
 * The /records query model is what the edge canonicalizes before any render, so every value a
 * crawler can mint freely must collapse to "no narrowing" rather than become a new cache key.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EMPTY_RECORDS_QUERY,
  isRecordsCombinationQuery,
  parseRecordsQuery,
  recordsHref,
  recordsQueryString,
} from './records-query';

test('real narrowings survive parse and build unchanged', () => {
  const query = parseRecordsQuery({ kind: 'school', era: '1950s', state: 'ga', evidence: 'b' });
  assert.equal(recordsHref(query), '/records?kind=school&era=1950s&state=GA&evidence=B');
});

test('values outside a facet shape narrow nothing', () => {
  const query = parseRecordsQuery({
    kind: 'x y<script>',
    era: '-1950s',
    state: 'Georgia',
    evidence: 'Z',
    status: 'a'.repeat(80),
  });
  assert.deepEqual(query, EMPTY_RECORDS_QUERY);
});

test('topic must be a real topic id', () => {
  assert.equal(parseRecordsQuery({ topic: 'zz-not-a-topic-3009218991' }).topic, '');
});

test('page is bounded and page 1 is never emitted', () => {
  assert.equal(parseRecordsQuery({ page: '99999999' }).page, 1000);
  assert.equal(parseRecordsQuery({ page: '-4' }).page, 1);
  assert.equal(recordsQueryString(parseRecordsQuery({ page: '1' })), '');
});

test('free text collapses whitespace and is length-bounded', () => {
  assert.equal(parseRecordsQuery({ q: '  harriet   tubman  ' }).q, 'harriet tubman');
  assert.equal(parseRecordsQuery({ q: 'x'.repeat(500) }).q.length, 120);
});

test('combination shapes are search results or two-plus constraints', () => {
  assert.equal(isRecordsCombinationQuery(parseRecordsQuery({ kind: 'school' })), false);
  assert.equal(isRecordsCombinationQuery(parseRecordsQuery({ page: '3' })), false);
  assert.equal(isRecordsCombinationQuery(parseRecordsQuery({ q: 'dunbar' })), true);
  assert.equal(isRecordsCombinationQuery(parseRecordsQuery({ kind: 'school', page: '2' })), true);
  assert.equal(isRecordsCombinationQuery(parseRecordsQuery({ kind: 'school', state: 'GA' })), true);
});
