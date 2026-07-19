/**
 * Tests for `buildDecadePresenceAggregates` — the convenience path over raw active
 * spans, layering `deriveActiveDecadeBuckets` on top of `aggregateDecadePresence`
 * (whose own active/cumulative aggregation logic is covered directly in
 * `decade-presence.test.ts`). These tests focus on the span-to-bucket derivation
 * seam: still-active cutoffs, multi-window spans, and undated entities.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildDecadePresenceAggregates,
  type DecadePresenceEntityInput,
} from './decade-presence-from-spans.js';

function entity(overrides: Partial<DecadePresenceEntityInput> & Pick<DecadePresenceEntityInput, 'entityId'>): DecadePresenceEntityInput {
  return {
    activeSpans: [],
    stateFips: '11',
    statePostalCode: 'DC',
    stateName: 'District of Columbia',
    ...overrides,
  };
}

test('an entity active only in the 1920s counts toward 1920s ACTIVE but not 1930s ACTIVE, while still counting toward both CUMULATIVE', () => {
  const entities: readonly DecadePresenceEntityInput[] = [
    entity({
      entityId: 'closed-in-1920s',
      activeSpans: [{ validFrom: '1922', validTo: '1929', datePrecision: 'year' }],
    }),
    entity({
      entityId: 'arrives-in-1930s',
      activeSpans: [{ validFrom: '1935', validTo: '1935', datePrecision: 'year' }],
    }),
  ];

  const decades = buildDecadePresenceAggregates(entities);
  const d1920s = decades.find((d) => d.decade === '1920s')!;
  const d1930s = decades.find((d) => d.decade === '1930s')!;

  assert.equal(d1920s.active[0]?.count, 1);
  assert.equal(d1930s.active.length, 1, '1930s ACTIVE excludes the entity that closed in the 1920s');
  assert.equal(d1930s.cumulative[0]?.count, 2, '1930s CUMULATIVE includes the since-closed entity too');
});

test('a still-active entity spans every decade through the supplied cutoff, in both active and cumulative views', () => {
  const entities: readonly DecadePresenceEntityInput[] = [
    entity({
      entityId: 'still-active-org',
      activeSpans: [{ validFrom: '1957', validTo: null, datePrecision: 'year' }],
    }),
  ];

  const decades = buildDecadePresenceAggregates(entities, { stillActiveCutoff: '1986' });
  assert.deepEqual(
    decades.map((d) => d.decade),
    ['1950s', '1960s', '1970s', '1980s'],
  );
  for (const view of decades) {
    assert.equal(view.active[0]?.count, 1, `${view.decade} ACTIVE must carry the still-active entity`);
    assert.equal(view.cumulative[0]?.count, 1, `${view.decade} CUMULATIVE must carry the still-active entity`);
  }
});

test('an entity with no parseable active span contributes to no decade (never guessed in)', () => {
  const entities: readonly DecadePresenceEntityInput[] = [
    entity({ entityId: 'undated', activeSpans: [] }),
    entity({
      entityId: 'dated',
      activeSpans: [{ validFrom: '1965', validTo: '1965', datePrecision: 'year' }],
    }),
  ];

  const decades = buildDecadePresenceAggregates(entities);
  assert.deepEqual(decades.map((d) => d.decade), ['1960s']);
  assert.equal(decades[0]!.active[0]?.count, 1, 'only the dated entity appears');
  assert.equal(decades[0]!.cumulative[0]?.count, 1);
});

test('decades are returned in chronological order and aggregate correctly across multiple states', () => {
  const entities: readonly DecadePresenceEntityInput[] = [
    entity({
      entityId: 'ga-1',
      stateFips: '13',
      statePostalCode: 'GA',
      stateName: 'Georgia',
      activeSpans: [{ validFrom: '1900', validTo: '1900', datePrecision: 'year' }],
    }),
    entity({
      entityId: 'dc-1',
      activeSpans: [{ validFrom: '1880', validTo: '1880', datePrecision: 'year' }],
    }),
    entity({
      entityId: 'ga-2',
      stateFips: '13',
      statePostalCode: 'GA',
      stateName: 'Georgia',
      activeSpans: [{ validFrom: '1900', validTo: '1900', datePrecision: 'year' }],
    }),
  ];

  const decades = buildDecadePresenceAggregates(entities);
  assert.deepEqual(decades.map((d) => d.decade), ['1880s', '1900s']);

  const d1900s = decades.find((d) => d.decade === '1900s')!;
  const gaAggregate = d1900s.active.find((a) => a.statePostalCode === 'GA');
  assert.equal(gaAggregate?.count, 2, 'both Georgia entities aggregate into one state count');
  assert.equal(d1900s.cumulative.length, 2, 'cumulative through 1900s carries GA and DC');
});

test('deterministic: re-running against the same input yields identical output', () => {
  const entities: readonly DecadePresenceEntityInput[] = [
    entity({
      entityId: 'a',
      activeSpans: [{ validFrom: '1968', validTo: '1970', datePrecision: 'year' }],
    }),
  ];
  const first = buildDecadePresenceAggregates(entities);
  const second = buildDecadePresenceAggregates(entities);
  assert.deepEqual(first, second);
});
