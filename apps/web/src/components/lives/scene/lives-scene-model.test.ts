/**
 * Lives scene layer model: empty cells stay empty; unit notes refuse mislabeling.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LivesDecadeBundle } from '@repo/domain/statistics/lives';
import { buildLivesSceneLayers } from './lives-scene-model';

function stubDecade(overrides: Partial<LivesDecadeBundle> = {}): LivesDecadeBundle {
  return {
    decade: 1960,
    label: '1960s',
    regime: 'household_income',
    regimeDescription: {
      regime: 'household_income',
      classLabel: 'Household income bands',
      readerNote: 'note',
    },
    boundaryFromPrevious: 'none',
    hispanicCounting: 'counted',
    classLabel: 'Household income bands',
    countNotes: [],
    classShares: {
      black: {
        lower: { state: 'pending' },
        middle: { state: 'pending' },
        upper: { state: 'pending' },
        unclassified: { state: 'not_measured' },
      },
      white: {
        lower: { state: 'pending' },
        middle: { state: 'pending' },
        upper: { state: 'pending' },
        unclassified: { state: 'not_measured' },
      },
      hispanic: {
        lower: { state: 'pending' },
        middle: { state: 'pending' },
        upper: { state: 'pending' },
        unclassified: { state: 'not_measured' },
      },
    },
    conditions: [
      {
        key: 'homeownership',
        label: 'Owning their home',
        universe: 'Occupied homes',
        cells: {
          black: { state: 'published', estimate: 38 },
          white: { state: 'published', estimate: 64 },
          hispanic: { state: 'not_measured', reason: 'Not counted.' },
        },
      },
      {
        key: 'high_school',
        label: 'Finished high school',
        universe: 'Adults 25 and older',
        cells: {
          black: { state: 'published', estimate: 22 },
          white: { state: 'published', estimate: 45 },
          hispanic: { state: 'pending' },
        },
      },
    ],
    rulesInForce: [],
    frame: null,
    worldBeats: [],
    ...overrides,
  };
}

test('scene layers caption published homeownership and empty hispanic cells', () => {
  const layers = buildLivesSceneLayers({
    decade: stubDecade(),
    emphasis: 'black',
    unit: 'household',
  });
  const houses = layers.find((layer) => layer.id === 'houses');
  assert.ok(houses);
  assert.equal(houses.status, 'published');
  assert.ok(houses.density > 0);
  assert.match(houses.caption, /38 percent/);
});

test('woman unit refuses to claim household tenure as her ownership', () => {
  const layers = buildLivesSceneLayers({
    decade: stubDecade(),
    emphasis: 'black',
    unit: 'woman',
  });
  const houses = layers.find((layer) => layer.id === 'houses');
  assert.ok(houses);
  assert.match(houses.caption, /not labeled as her ownership/);
});

test('vehicles stay costume, not ownership', () => {
  const layers = buildLivesSceneLayers({
    decade: stubDecade(),
    emphasis: 'black',
    unit: 'household',
  });
  const vehicles = layers.find((layer) => layer.id === 'vehicles');
  assert.ok(vehicles);
  assert.equal(vehicles.status, 'costume');
  assert.match(vehicles.caption, /not a published ownership rate/);
});
