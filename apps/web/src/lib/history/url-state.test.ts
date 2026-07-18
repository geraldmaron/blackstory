/**
 * Unit tests for history URL state parse/serialize helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildHistoryHref, parseHistorySearchParams } from './url-state';

test('defaults to all-time mode with no query params', () => {
  const state = parseHistorySearchParams({});
  assert.equal(state.mode, 'all-time');
  assert.equal(state.filters.kind, 'all');
});

test('parses decade mode and rebuilds shareable href', () => {
  const state = parseHistorySearchParams({ decade: '1970s', kind: 'event', selected: 'ent_dc_landmark_listing_1975' });
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

test('rejects malformed decade labels', () => {
  const state = parseHistorySearchParams({ decade: 'nineteen-fifties' });
  assert.equal(state.mode, 'all-time');
  assert.equal(state.decade, undefined);
});
