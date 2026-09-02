/**
 * `locationPrecisionFromProjection` names the public tier for every raw `location.precision`
 * value the active release carries (audit 2026-09-02: 23 distinct values). The pre-fix behaviour
 * collapsed anything outside four pass-through values to `city`, so a listed building with a
 * documented street address told readers it was only known to the city (repo-ywh6).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { locationPrecisionFromProjection } from './map-projection';

/** Every raw value observed in bb_public.release_entities on 2026-09-02, with its tier. */
const OBSERVED: ReadonlyArray<readonly [raw: string, tier: string]> = [
  ['site', 'site'],
  ['county', 'county'],
  ['city', 'city'],
  ['institution', 'institution'],
  ['campus', 'campus'],
  ['address', 'site'],
  ['neighborhood', 'neighborhood'],
  ['community', 'neighborhood'],
  ['town', 'city'],
  ['district', 'neighborhood'],
  ['cemetery', 'campus'],
  ['state', 'state'],
  ['block', 'site'],
  ['building', 'site'],
  ['park', 'campus'],
  ['park-site', 'campus'],
  ['camp', 'campus'],
  ['country', 'state'],
  ['garrison', 'campus'],
  ['region', 'state'],
  ['territory', 'state'],
  ['stadium', 'campus'],
];

test('every raw precision value in the active release maps to a named tier', () => {
  for (const [raw, tier] of OBSERVED) {
    assert.equal(locationPrecisionFromProjection(raw), tier, `raw value "${raw}"`);
  }
});

test('a verified site never collapses to city', () => {
  assert.equal(locationPrecisionFromProjection('site'), 'site');
  assert.equal(locationPrecisionFromProjection('Site '), 'site');
});

test('missing or unknown values fall to city, never sharper', () => {
  assert.equal(locationPrecisionFromProjection(undefined), 'city');
  assert.equal(locationPrecisionFromProjection(''), 'city');
  assert.equal(locationPrecisionFromProjection('exact_coordinates'), 'city');
  assert.equal(locationPrecisionFromProjection('street_address'), 'city');
});
