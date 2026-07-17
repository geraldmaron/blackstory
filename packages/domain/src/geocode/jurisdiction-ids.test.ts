/**
 * Tests for BB-050 jurisdiction-id resolution — proves the id scheme matches
 * `packages/firebase/src/jurisdictions/schema.ts` exactly (`us`, `us-{state}`,
 * `us-{state}-{county}`) and that place/city resolution stays on-demand-only (ADR-016).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CensusGeocodeMatch } from '../adapters/census-geo/types.js';
import {
  countryJurisdictionId,
  countyJurisdictionId,
  placeJurisdictionId,
  resolveJurisdictionIdsFromMatch,
  stateJurisdictionId,
} from './jurisdiction-ids.js';

test('id builders match the packages/firebase/src/jurisdictions/schema.ts scheme exactly', () => {
  assert.equal(countryJurisdictionId(), 'us');
  assert.equal(stateJurisdictionId('11'), 'us-11');
  assert.equal(countyJurisdictionId('11', '001'), 'us-11-001');
  assert.equal(placeJurisdictionId('11', '50000'), 'us-11-place-50000');
});

const FULL_MATCH: CensusGeocodeMatch = {
  matchedAddress: '4600 SILVER HILL RD, WASHINGTON, DC, 20233',
  lat: 38.846,
  lng: -76.927,
  stateFips: '11',
  stateName: 'District of Columbia',
  countyFips3: '001',
  countyName: 'District of Columbia',
  placeFips: '50000',
  placeName: 'Washington',
};

test('resolveJurisdictionIdsFromMatch resolves state + county + a place create-hint', () => {
  const resolved = resolveJurisdictionIdsFromMatch(FULL_MATCH);
  assert.equal(resolved.countryId, 'us');
  assert.equal(resolved.stateId, 'us-11');
  assert.equal(resolved.countyId, 'us-11-001');
  assert.equal(resolved.placeId, 'us-11-place-50000');
  assert.deepEqual(resolved.placeCreateHint, {
    id: 'us-11-place-50000',
    name: 'Washington',
    stateFips: '11',
    placeFips: '50000',
    parentId: 'us-11',
  });
});

test('resolveJurisdictionIdsFromMatch resolves only country when no state FIPS is present', () => {
  const resolved = resolveJurisdictionIdsFromMatch({ lat: 0, lng: 0 });
  assert.deepEqual(resolved, { countryId: 'us' });
});

test('resolveJurisdictionIdsFromMatch resolves state + county without a place id when place FIPS is absent', () => {
  const resolved = resolveJurisdictionIdsFromMatch({
    lat: 41.88,
    lng: -87.63,
    stateFips: '17',
    countyFips3: '031',
  });
  assert.equal(resolved.stateId, 'us-17');
  assert.equal(resolved.countyId, 'us-17-031');
  assert.equal(resolved.placeId, undefined);
  assert.equal(resolved.placeCreateHint, undefined);
});
