import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  POPULATION_DECADES,
  POPULATION_DECADE_METAS,
  HISTORICAL_NATIONAL_DECADES,
  MODERN_COUNTY_DECADES,
  FREE_ENSLAVED_SPLIT_DECADES,
  isPopulationDecade,
  getPopulationDecadeMeta,
  changeCrossesDefinitionBoundary,
} from './population-decades.js';

test('covers every decade 1790–2020 in ascending order with no gaps', () => {
  assert.equal(POPULATION_DECADES.length, 24);
  assert.equal(POPULATION_DECADES[0], '1790');
  assert.equal(POPULATION_DECADES.at(-1), '2020');
  for (let i = 1; i < POPULATION_DECADE_METAS.length; i += 1) {
    assert.equal(POPULATION_DECADE_METAS[i]!.year - POPULATION_DECADE_METAS[i - 1]!.year, 10);
  }
});

test('twps0056 lane is 1790–1990, county-sum lane is 2000–2020, disjoint years', () => {
  assert.deepEqual([...HISTORICAL_NATIONAL_DECADES].at(-1), '1990');
  assert.deepEqual([...MODERN_COUNTY_DECADES], ['2000', '2010', '2020']);
  const overlap = HISTORICAL_NATIONAL_DECADES.filter((d) => MODERN_COUNTY_DECADES.includes(d));
  assert.deepEqual(overlap, [], 'lanes must not share a decade — no double counting');
});

test('free/enslaved split is exactly 1790–1860', () => {
  assert.deepEqual(
    [...FREE_ENSLAVED_SPLIT_DECADES],
    ['1790', '1800', '1810', '1820', '1830', '1840', '1850', '1860'],
  );
  assert.equal(getPopulationDecadeMeta('1860')!.hasFreeEnslavedSplit, true);
  assert.equal(getPopulationDecadeMeta('1870')!.hasFreeEnslavedSplit, false);
});

test('only 2000 opens a measurement-regime boundary; 1870 carries the undercount caveat', () => {
  const boundaryDecades = POPULATION_DECADE_METAS.filter((m) => m.opensDefinitionBoundary).map(
    (m) => m.decade,
  );
  assert.deepEqual(boundaryDecades, ['2000']);
  assert.equal(getPopulationDecadeMeta('1870')!.southernUndercountCaveat, true);
  assert.equal(getPopulationDecadeMeta('1860')!.southernUndercountCaveat, false);
});

test('changeCrossesDefinitionBoundary flags only the adjacent 1990→2000 transition', () => {
  assert.equal(changeCrossesDefinitionBoundary('1990', '2000'), true);
  assert.equal(changeCrossesDefinitionBoundary('2000', '2010'), false);
  assert.equal(changeCrossesDefinitionBoundary('1860', '1870'), false);
  // Non-adjacent decades never produce a boundary flag.
  assert.equal(changeCrossesDefinitionBoundary('1980', '2000'), false);
});

test('isPopulationDecade guards the grammar', () => {
  assert.equal(isPopulationDecade('1790'), true);
  assert.equal(isPopulationDecade('2020'), true);
  assert.equal(isPopulationDecade('1785'), false);
  assert.equal(isPopulationDecade('2030'), false);
});
