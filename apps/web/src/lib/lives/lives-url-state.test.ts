import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_LIVES_VIEW,
  buildLivesHref,
  buildLivesSearchParams,
  parseLivesSearchParams,
} from './lives-url-state';

test('empty params open the default view', () => {
  assert.deepEqual(parseLivesSearchParams({}), DEFAULT_LIVES_VIEW);
  assert.equal(buildLivesHref('chicago', DEFAULT_LIVES_VIEW), '/lives/chicago');
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

test('malformed or out-of-range values fall back to defaults', () => {
  const state = parseLivesSearchParams({
    race: 'black_alone',
    tier: 'rich',
    decade: '1955',
  });
  assert.deepEqual(state, DEFAULT_LIVES_VIEW);
  assert.equal(parseLivesSearchParams({ decade: '2030' }).decade, DEFAULT_LIVES_VIEW.decade);
});

test('the first value of a repeated param wins', () => {
  assert.equal(parseLivesSearchParams({ race: ['white_nh', 'hispanic'] }).race, 'white_nh');
});
