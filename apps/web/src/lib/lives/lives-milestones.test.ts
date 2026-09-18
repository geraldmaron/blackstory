import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  LivesAreaBundle,
  LivesCell,
  LivesConditionKey,
  LivesDecade,
  LivesDecadeBundle,
} from '@repo/domain/statistics/lives';
import {
  LIVES_MILESTONES,
  buildLivesMilestonePanels,
  parseLivesMilestone,
} from './lives-milestones';

function cell(estimate?: number, withSource = true): LivesCell {
  return estimate === undefined
    ? { state: 'pending', reason: 'Not transcribed' }
    : {
        state: 'published',
        estimate,
        definitionLabel: 'Published definition',
        ...(withSource
          ? { sources: [{ label: 'Census table', url: 'https://www.census.gov/table' }] }
          : {}),
      };
}

function decade(
  year: LivesDecade,
  key: LivesConditionKey,
  values: { readonly black?: number; readonly white?: number; readonly hispanic?: number },
): LivesDecadeBundle {
  return {
    decade: year,
    label: `${year}s`,
    conditions: [
      {
        key,
        label: 'Owning their home',
        universe: 'Occupied homes',
        cells: {
          black: cell(values.black),
          white: cell(values.white),
          hispanic: cell(values.hispanic),
        },
      },
    ],
    countNotes: [],
    worldBeats: [],
    rulesInForce: [],
  } as unknown as LivesDecadeBundle;
}

function bundle(decades: readonly LivesDecadeBundle[]): LivesAreaBundle {
  return {
    areaId: 'nation:US',
    areaSlug: 'united-states',
    areaName: 'United States',
    areaKind: 'nation',
    decades,
    disclaimer: 'Comparison is not causation.',
  };
}

test('milestone parsing defaults to home and accepts a known key', () => {
  assert.equal(parseLivesMilestone(undefined).key, 'home');
  assert.equal(parseLivesMilestone('education').key, 'education');
  assert.equal(parseLivesMilestone('unknown').key, 'home');
});

test('an era uses its latest cited Black comparison and does not create blank panels', () => {
  const milestone = LIVES_MILESTONES[0]!;
  const panels = buildLivesMilestonePanels(
    bundle([
      decade(1900, 'homeownership', { black: 20, white: 45 }),
      decade(1920, 'homeownership', { black: 25, white: 52 }),
      decade(1930, 'homeownership', { black: 28 }),
      decade(1940, 'homeownership', { white: 60 }),
    ]),
    milestone,
  );

  assert.equal(panels.length, 1);
  assert.equal(panels[0]?.era.id, '1900-1930');
  assert.equal(panels[0]?.decade.decade, 1920);
  assert.deepEqual(
    panels[0]?.values.map((value) => value.lens),
    ['black', 'white'],
  );
});

test('uncited values are not publishable on the guided surface', () => {
  const uncited = decade(2020, 'homeownership', { black: 44, white: 73 });
  const condition = uncited.conditions[0]!;
  const withoutSources = {
    ...uncited,
    conditions: [
      {
        ...condition,
        cells: {
          ...condition.cells,
          black: cell(44, false),
        },
      },
    ],
  };
  assert.deepEqual(buildLivesMilestonePanels(bundle([withoutSources]), LIVES_MILESTONES[0]!), []);
});
