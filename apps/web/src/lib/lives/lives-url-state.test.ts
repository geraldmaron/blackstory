import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_LIVES_VIEW,
  buildLivesDataEntryHref,
  buildLivesHref,
  buildLivesSearchParams,
  parseLivesAreaSlug,
  parseLivesSearchParams,
} from './lives-url-state';

test('empty params open the default view in the evidence appendix', () => {
  assert.deepEqual(parseLivesSearchParams({}), DEFAULT_LIVES_VIEW);
  assert.equal(buildLivesHref('deep-south', DEFAULT_LIVES_VIEW), '/lives/explorer?area=deep-south');
  assert.equal(buildLivesHref('united-states', DEFAULT_LIVES_VIEW), '/lives/explorer');
  assert.equal(buildLivesDataEntryHref('united-states', DEFAULT_LIVES_VIEW), '/data#lives');
});

test('valid params round-trip through the query string', () => {
  const state = parseLivesSearchParams({
    race: 'hispanic',
    tier: 'middle',
    decade: '1950',
    unit: 'child',
  });
  assert.deepEqual(state, { race: 'hispanic', decade: 1950 });
  assert.equal(buildLivesSearchParams(state), 'race=hispanic&decade=1950');
  assert.deepEqual(
    parseLivesSearchParams(Object.fromEntries(new URLSearchParams(buildLivesSearchParams(state)))),
    state,
  );
});

test('a decade label with a trailing s is accepted', () => {
  assert.equal(parseLivesSearchParams({ decade: '1960s' }).decade, 1960);
});

test('old slice ids and off-grid decades fall back to defaults', () => {
  assert.deepEqual(
    parseLivesSearchParams({ race: 'black_nh', tier: 'rich', decade: '1955', unit: 'player' }),
    DEFAULT_LIVES_VIEW,
  );
  assert.equal(parseLivesSearchParams({ decade: '2030' }).decade, DEFAULT_LIVES_VIEW.decade);
});

test('retired unit and tier params are ignored and removed from generated links', () => {
  const state = parseLivesSearchParams({ tier: 'middle', unit: 'child', decade: '1950' });
  assert.deepEqual(state, { race: 'black', decade: 1950 });
  assert.equal(buildLivesHref('united-states', state), '/lives/explorer?decade=1950');
});

test('the first value of a repeated param wins', () => {
  assert.equal(parseLivesSearchParams({ race: ['white', 'hispanic'] }).race, 'white');
});

test('area query falls back to the national baseline', () => {
  assert.equal(parseLivesAreaSlug({}), 'united-states');
  assert.equal(parseLivesAreaSlug({ area: 'midwest' }), 'midwest');
  assert.equal(parseLivesAreaSlug({ area: 'not-a-region' }), 'united-states');
});
