/**
 * Unit tests for Explore population geography/decade validation and comparability notes.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  coercePopulationGeoForDecade,
  defaultPopulationChangeFrom,
  parseExplorePopulationDecade,
  parseExplorePopulationGeo,
  populationChangeComparabilityNote,
  populationDecadeComparabilityNote,
  populationDecadesForGeo,
} from './explore-population';

test('populationDecadesForGeo exposes full state lane and modern county lane', () => {
  assert.deepEqual(populationDecadesForGeo('county'), ['2000', '2010', '2020']);
  assert.equal(populationDecadesForGeo('state').length, 24);
  assert.equal(populationDecadesForGeo('state')[0], '1790');
  assert.equal(populationDecadesForGeo('state').at(-1), '2020');
});

test('parseExplorePopulationDecade rejects invalid decades per geography', () => {
  assert.equal(parseExplorePopulationDecade('1870', 'state', '2020'), '1870');
  assert.equal(parseExplorePopulationDecade('1870', 'county', '2020'), '2020');
  assert.equal(parseExplorePopulationDecade('2010', 'county', '2020'), '2010');
});

test('coercePopulationGeoForDecade switches to state for pre-2000 county requests', () => {
  assert.equal(coercePopulationGeoForDecade('county', '1870'), 'state');
  assert.equal(coercePopulationGeoForDecade('county', '2020'), 'county');
});

test('comparability notes surface measurement-regime boundaries', () => {
  assert.match(populationDecadeComparabilityNote('2000') ?? '', /Black alone/i);
  assert.match(populationDecadeComparabilityNote('1870') ?? '', /undercount/i);
  assert.match(populationChangeComparabilityNote('1990', '2000') ?? '', /measurement-regime/i);
});

test('state change defaults start at 1990 when county defaults start at 2010', () => {
  assert.equal(defaultPopulationChangeFrom('state'), '1990');
  assert.equal(defaultPopulationChangeFrom('county'), '2010');
});

test('parseExplorePopulationGeo falls back to county', () => {
  assert.equal(parseExplorePopulationGeo(undefined), 'county');
  assert.equal(parseExplorePopulationGeo('state'), 'state');
  assert.equal(parseExplorePopulationGeo('nope'), 'county');
});
