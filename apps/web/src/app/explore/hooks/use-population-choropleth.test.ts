/**
 * `populationChoroplethRequest` is the whole decision `usePopulationChoropleth` makes: which
 * geography and which vintages to ask the compact index for, given the active layer model and
 * whatever `popGeo`/`popDecade`/`popFrom`/`popTo` the URL happened to seed. Tested here as a pure
 * function so the fallback-to-defaults path (a Lens toggle with no matching URL state) does not
 * need a React renderer.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { populationChoroplethRequest } from './use-population-choropleth';
import type { ExploreViewState } from '../../../lib/map-experience/url-state';

type ViewStateSlice = Pick<ExploreViewState, 'popGeo' | 'popDecade' | 'popFrom' | 'popTo'>;

const EMPTY: ViewStateSlice = {};

test('off and presence never request the population index', () => {
  assert.equal(populationChoroplethRequest('off', EMPTY), undefined);
  assert.equal(populationChoroplethRequest('presence', EMPTY), undefined);
});

test('blackShare with no URL state falls back to the default geography and decade', () => {
  const request = populationChoroplethRequest('blackShare', EMPTY);
  assert.deepEqual(request, {
    geo: 'county',
    mode: 'blackShare',
    decade: '2020',
    fromDecade: '2010',
    toDecade: '2020',
  });
});

test('blackChange with no URL state falls back to the default county from/to pair', () => {
  const request = populationChoroplethRequest('blackChange', EMPTY);
  assert.deepEqual(request, {
    geo: 'county',
    mode: 'blackChange',
    decade: '2020',
    fromDecade: '2010',
    toDecade: '2020',
  });
});

test('URL-seeded popGeo/popDecade carry through for blackShare', () => {
  const request = populationChoroplethRequest('blackShare', {
    popGeo: 'state',
    popDecade: '1950',
  });
  assert.deepEqual(request, {
    geo: 'state',
    mode: 'blackShare',
    decade: '1950',
    fromDecade: '1990',
    toDecade: '2020',
  });
});

test('a pre-2000 decade coerces county geography down to state (no county FIPS that far back)', () => {
  const request = populationChoroplethRequest('blackShare', {
    popGeo: 'county',
    popDecade: '1950',
  });
  assert.equal(request?.geo, 'state');
});

test('blackChange coerces on the "to" decade, matching the URL parser and the layer picker', () => {
  const request = populationChoroplethRequest('blackChange', {
    popGeo: 'county',
    popFrom: '1950',
    popTo: '1960',
  });
  assert.equal(request?.geo, 'state');
});

test('county requests narrow decade fields to census vintages only', () => {
  const request = populationChoroplethRequest('blackShare', {
    popGeo: 'county',
    popDecade: '2010',
  });
  assert.deepEqual(request, {
    geo: 'county',
    mode: 'blackShare',
    decade: '2010',
    fromDecade: '2010',
    toDecade: '2020',
  });
});
