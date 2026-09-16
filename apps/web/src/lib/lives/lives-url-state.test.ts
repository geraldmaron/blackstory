import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_LIVES_VIEW,
  buildLivesHref,
  buildLivesSearchParams,
  parseLivesAreaSlug,
  parseLivesSearchParams,
} from './lives-url-state';

test('empty params open the default view', () => {
  assert.deepEqual(parseLivesSearchParams({}), DEFAULT_LIVES_VIEW);
  assert.equal(
    buildLivesHref('deep-south', DEFAULT_LIVES_VIEW),
    '/how-it-works?s=lives&area=deep-south',
  );
  assert.equal(buildLivesHref('united-states', DEFAULT_LIVES_VIEW), '/how-it-works?s=lives');
});

test('valid params round-trip through the query string', () => {
  const state = parseLivesSearchParams({ race: 'hispanic', tier: 'middle', decade: '1950' });
  assert.deepEqual(state, { race: 'hispanic', tier: 'middle', decade: 1950 });
  assert.equal(buildLivesSearchParams(state), 'race=hispanic&tier=middle&decade=1950');
  assert.deepEqual(
    parseLivesSearchParams(Object.fromEntries(new URLSearchParams(buildLivesSearchParams(state)))),
    state,
  );
});

test('a decade label with a trailing s is accepted', () => {
  assert.equal(parseLivesSearchParams({ decade: '1960s' }).decade, 1960);
});

test('old slice ids, unknown tiers and off-grid decades fall back to defaults', () => {
  assert.deepEqual(
    parseLivesSearchParams({ race: 'black_nh', tier: 'rich', decade: '1955' }),
    DEFAULT_LIVES_VIEW,
  );
  assert.equal(parseLivesSearchParams({ decade: '2030' }).decade, DEFAULT_LIVES_VIEW.decade);
});

test('the first value of a repeated param wins', () => {
  assert.equal(parseLivesSearchParams({ race: ['white', 'hispanic'] }).race, 'white');
});

test('area query falls back to the national baseline', () => {
  assert.equal(parseLivesAreaSlug({}), 'united-states');
  assert.equal(parseLivesAreaSlug({ area: 'midwest' }), 'midwest');
  assert.equal(parseLivesAreaSlug({ area: 'not-a-region' }), 'united-states');
});
