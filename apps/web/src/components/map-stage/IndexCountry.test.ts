/** The legend must never claim more lights than rows, and must say when rows are unlit. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countryLegend } from './IndexCountry.tsx';

test('the legend counts lights against the rows listed', () => {
  assert.equal(countryLegend(0, 0), '');
  assert.equal(countryLegend(0, 3), 'None of the records on this page has a mapped place.');
  assert.equal(countryLegend(1, 1), '1 light, a record on this page.');
  assert.equal(countryLegend(100, 100), '100 lights, each a record on this page.');
  assert.equal(
    countryLegend(98, 100),
    '98 lights, each a record on this page. 2 more have no mapped place.',
  );
  assert.equal(
    countryLegend(2, 3),
    '2 lights, each a record on this page. 1 more has no mapped place.',
  );
});
