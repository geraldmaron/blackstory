/**
 * Unit tests for history URL state parse/serialize helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildHistoryHref, parseDecadeParam, parseHistorySearchParams } from './url-state';

test('defaults to all-time mode with no query params', () => {
  const state = parseHistorySearchParams({});
  assert.equal(state.mode, 'all-time');
  assert.equal(state.filters.kind, 'all');
  assert.equal(state.filters.status, 'all');
  assert.equal(state.filters.topic, 'all');
  assert.equal(state.filters.connections, 'all');
});

test('parses decade mode and rebuilds shareable href', () => {
  const state = parseHistorySearchParams({
    decade: '1970s',
    kind: 'event',
    selected: 'ent_dc_landmark_listing_1975',
  });
  assert.equal(state.mode, 'decade');
  assert.equal(state.decade, '1970s');
  assert.equal(state.filters.kind, 'event');
  assert.equal(state.selected, 'ent_dc_landmark_listing_1975');
  assert.equal(
    buildHistoryHref(state),
    '/history?decade=1970s&kind=event&selected=ent_dc_landmark_listing_1975',
  );
});

test('parses q and sort into shareable href', () => {
  const state = parseHistorySearchParams({ q: 'dunbar', sort: 'connections', kind: 'school' });
  assert.equal(state.filters.q, 'dunbar');
  assert.equal(state.filters.sort, 'connections');
  assert.equal(state.filters.kind, 'school');
  assert.equal(buildHistoryHref(state), '/history?kind=school&q=dunbar&sort=connections');
});

test('parses status, topic, and connections into shareable href', () => {
  const state = parseHistorySearchParams({
    status: 'historic',
    topic: 'education',
    connections: 'with',
  });
  assert.equal(state.filters.status, 'historic');
  assert.equal(state.filters.topic, 'education');
  assert.equal(state.filters.connections, 'with');
  assert.equal(
    buildHistoryHref(state),
    '/history?status=historic&topic=education&connections=with',
  );
});

test('omits default status, topic, and connections from href', () => {
  const state = parseHistorySearchParams({ status: 'all', topic: 'all', connections: 'all' });
  assert.equal(buildHistoryHref(state), '/history');
});

test('rejects malformed decade labels', () => {
  const state = parseHistorySearchParams({ decade: 'nineteen-fifties' });
  assert.equal(state.mode, 'all-time');
  assert.equal(state.decade, undefined);
});

test('rejects future decade labels that have not started yet', () => {
  assert.equal(parseDecadeParam('2030s'), undefined);
  assert.equal(parseDecadeParam('2050s'), undefined);
  const state = parseHistorySearchParams({ decade: '2030s' });
  assert.equal(state.mode, 'all-time');
  assert.equal(state.decade, undefined);
});

test('normalizes invalid connections values to all', () => {
  const state = parseHistorySearchParams({ connections: 'maybe' });
  assert.equal(state.filters.connections, 'all');
});
