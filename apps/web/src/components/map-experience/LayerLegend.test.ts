import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { bucketBlackChangeTier, bucketBlackShareTier } from '@repo/domain/map/county-population';
import {
  DENSITY_TIER_FILL,
  POPULATION_CHANGE_TIER_FILL,
  POPULATION_SHARE_TIER_FILL,
} from '../../lib/map-experience/dignity-style';
import { buildStateDensityLevels } from '../../lib/map-experience/density';
import {
  LayerLegend,
  changeLegendRows,
  classEdges,
  presenceLegendRows,
  shareLegendRows,
} from './LayerLegend';

const NUDGE = 0.001;

test('every class edge is where the shared classifier itself changes class', () => {
  for (const [bucket, min, max] of [
    [bucketBlackShareTier, 0, 100],
    [bucketBlackChangeTier, -100, 100],
  ] as const) {
    const edges = classEdges(bucket as (value: number) => string, min, max);
    assert.ok(edges.length > 0);
    for (const edge of edges) {
      // The edge belongs to the class farther from zero; a hair toward zero is the other class.
      const outer = edge.at > 0 ? edge.above : edge.below;
      const inner = edge.at > 0 ? edge.below : edge.above;
      assert.equal(bucket(edge.at), outer);
      assert.equal(bucket(edge.at - Math.sign(edge.at) * NUDGE), inner);
    }
  }
});

test('the share and change keys have one row per painted class, in the paint of that class', () => {
  const share = shareLegendRows();
  assert.deepEqual(
    share.map((row) => row.key).sort(),
    Object.keys(POPULATION_SHARE_TIER_FILL).sort(),
  );
  for (const row of share) {
    assert.equal(row.color, POPULATION_SHARE_TIER_FILL[row.key as 'trace']);
  }
  assert.match(share[0]!.range, /% or more$/);
  assert.match(share.at(-1)!.range, /^Under \d/);

  const change = changeLegendRows();
  assert.deepEqual(
    change.map((row) => row.key).sort(),
    Object.keys(POPULATION_CHANGE_TIER_FILL).sort(),
  );
  // Diverging: signed ranges either side of a neutral band, and a mark that is not color.
  assert.match(change[0]!.range, /^\+\d+ points or more$/);
  assert.match(change.at(-1)!.range, /^−\d+ points or lower$/);
  const neutral = change.find((row) => row.key === 'neutral')!;
  assert.match(neutral.range, /^Between −\d+ and \+\d+ points$/);
  assert.ok(change.every((row) => row.cue));
  assert.equal(new Set(change.map((row) => row.cue)).size, change.length);
});

test('the density key reports the counts the states in each tier hold', () => {
  const levels = buildStateDensityLevels(
    [3, 9, 20, 41, 80, 300].map((count, index) => ({
      stateFips: String(index),
      statePostalCode: `S${index}`,
      stateName: `State ${index}`,
      count,
    })),
  );
  const rows = presenceLegendRows(levels);
  for (const row of rows) {
    assert.equal(row.color, DENSITY_TIER_FILL[row.key as 'documented']);
    const counts = levels.filter((level) => level.tier === row.key).map((level) => level.count);
    assert.ok(row.range.includes(Math.min(...counts).toLocaleString('en-US')));
    assert.ok(row.range.includes(Math.max(...counts).toLocaleString('en-US')));
  }
  assert.deepEqual(presenceLegendRows([]), []);
});

test('the change key states its unit, geography, years, missing data and the table view', () => {
  const html = renderToStaticMarkup(
    createElement(LayerLegend, {
      mode: 'blackChange',
      population: { geo: 'county', decade: '2020', fromDecade: '2010', toDecade: '2020' },
    }),
  );
  assert.match(html, /percentage points, for each county, from the 2010 Census to the 2020 Census/);
  assert.match(html, /No Census figure/);
  assert.match(html, /href="\/data\/D-05"/);
  assert.equal((html.match(/ds-xlegend__row"/g) ?? []).length, changeLegendRows().length + 1);
});
