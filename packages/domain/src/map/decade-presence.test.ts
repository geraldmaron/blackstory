/**
 * Tests for `aggregateDecadePresence` — per-decade state presence aggregation over
 * entities' ALREADY-DERIVED decade-bucket membership (the map layer's `eraBuckets`
 * shape). The critical proof: active and cumulative aggregates genuinely diverge
 * (an entity that stopped being active does not inflate a later decade's ACTIVE
 * count, but still counts toward that later decade's CUMULATIVE count).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregateDecadePresence } from './decade-presence.js';

function entity(
  entityId: string,
  decadeBuckets: readonly string[],
  overrides: { readonly stateFips?: string; readonly statePostalCode?: string; readonly stateName?: string } = {},
) {
  return {
    entityId,
    decadeBuckets,
    stateFips: overrides.stateFips ?? '11',
    statePostalCode: overrides.statePostalCode ?? 'DC',
    stateName: overrides.stateName ?? 'District of Columbia',
  };
}

test('an entity active only in the 1920s counts toward 1920s ACTIVE but not 1930s ACTIVE, while still counting toward both CUMULATIVE', () => {
  const decades = aggregateDecadePresence([
    entity('closed-in-1920s', ['1920s']),
    entity('arrives-in-1930s', ['1930s']),
  ]);
  const d1920s = decades.find((d) => d.decade === '1920s')!;
  const d1930s = decades.find((d) => d.decade === '1930s')!;

  assert.equal(d1920s.active[0]?.count, 1, '1920s ACTIVE holds only the entity active that decade');
  assert.equal(d1930s.active.length, 1, '1930s ACTIVE excludes the entity that closed in the 1920s');
  assert.equal(d1930s.active[0]?.count, 1);

  // Cumulative through the 1930s carries BOTH entities — the archive-fills-in framing.
  assert.equal(d1930s.cumulative[0]?.count, 2, '1930s CUMULATIVE includes the since-closed entity too');
  assert.equal(d1920s.cumulative[0]?.count, 1, '1920s CUMULATIVE does not include the not-yet-arrived entity');
});

test('a decade-bucket span covering multiple decades counts toward ACTIVE in every one of those decades', () => {
  const decades = aggregateDecadePresence([entity('still-active-org', ['1950s', '1960s', '1970s', '1980s'])]);
  assert.deepEqual(
    decades.map((d) => d.decade),
    ['1950s', '1960s', '1970s', '1980s'],
  );
  for (const view of decades) {
    assert.equal(view.active[0]?.count, 1, `${view.decade} ACTIVE must carry the spanning entity`);
    assert.equal(view.cumulative[0]?.count, 1, `${view.decade} CUMULATIVE must carry the spanning entity`);
  }
});

test('an entity with an empty decade-bucket list contributes to no decade (never guessed in)', () => {
  const decades = aggregateDecadePresence([
    entity('undated', []),
    entity('dated', ['1960s']),
  ]);
  assert.deepEqual(decades.map((d) => d.decade), ['1960s']);
  assert.equal(decades[0]!.active[0]?.count, 1, 'only the dated entity appears');
  assert.equal(decades[0]!.cumulative[0]?.count, 1);
});

test('decades are returned in chronological order and aggregate correctly across multiple states', () => {
  const decades = aggregateDecadePresence([
    entity('ga-1', ['1900s'], { stateFips: '13', statePostalCode: 'GA', stateName: 'Georgia' }),
    entity('dc-1', ['1880s']),
    entity('ga-2', ['1900s'], { stateFips: '13', statePostalCode: 'GA', stateName: 'Georgia' }),
  ]);
  assert.deepEqual(decades.map((d) => d.decade), ['1880s', '1900s']);

  const d1900s = decades.find((d) => d.decade === '1900s')!;
  const gaAggregate = d1900s.active.find((a) => a.statePostalCode === 'GA');
  assert.equal(gaAggregate?.count, 2, 'both Georgia entities aggregate into one state count');
  assert.equal(d1900s.cumulative.length, 2, 'cumulative through 1900s carries GA and DC');
});

test('a wholly undated input set produces no decades at all', () => {
  const decades = aggregateDecadePresence([entity('undated', [])]);
  assert.deepEqual(decades, []);
});

test('deterministic: re-running against the same input yields identical output', () => {
  const entities = [entity('a', ['1960s', '1970s'])];
  const first = aggregateDecadePresence(entities);
  const second = aggregateDecadePresence(entities);
  assert.deepEqual(first, second);
});
