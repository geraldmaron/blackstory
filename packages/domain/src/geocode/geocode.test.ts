/**
 * Tests for the geocode pipeline, cache, coordinate-precision reduction, ZIP
 * translate-then-discard, manual fallback, product scope, and coarse analytics all against a
 * fake `CensusAddressGeocodeFetcher`/`CensusCoordinatesGeocodeFetcher` (no network I/O; the
 * live Census HTTP call is covered separately in
 * `../adapters/census-geo/geocoder-client.test.ts`).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CensusGeocodeMatch } from '../adapters/census-geo/types.js';
import {
  normalizeAddressInput,
  coordinateCacheKey,
  expandCommonAbbreviations,
} from './address-normalize.js';
import { buildCoarseLocationAnalyticsEvent } from './analytics.js';
import {
  geoPrecisionTierForMatch,
  reduceGeocodeCoordinatePrecision,
} from './coordinate-precision.js';
import { createGeocodeCache } from './geocode-cache.js';
import { buildManualPlaceSearchFallback } from './manual-fallback.js';
import { geocodeAddress, reverseGeocodeCoordinates, type GeocodeResult } from './pipeline.js';
import { evaluateGeocodeProductScope } from './product-scope.js';
import type { GeocodeResolution } from './types.js';
import { translateZipToPlace } from './zip-translate.js';
import { isUsZipOnlyInput, normalizeUsZipInput } from './zip-normalize.js';
import { lookupUsZipCentroid } from './zip-centroid.js';

const DC_MATCH: CensusGeocodeMatch = {
  matchedAddress: '4600 SILVER HILL RD, WASHINGTON, DC, 20233',
  lat: 38.846,
  lng: -76.927,
  stateFips: '11',
  stateName: 'District of Columbia',
  countyFips3: '001',
  countyName: 'District of Columbia',
  placeFips: '50000',
  placeName: 'Washington',
  zip: '20233',
};

const TERRITORY_MATCH: CensusGeocodeMatch = {
  matchedAddress: '1 CALLE PRINCIPAL, SAN JUAN, PR, 00901',
  lat: 18.46,
  lng: -66.1,
  stateFips: '72',
  stateName: 'Puerto Rico',
  countyFips3: '127',
};

test('normalizeAddressInput collapses whitespace and expands street-suffix abbreviations', () => {
  const normalized = normalizeAddressInput('  4600   Silver Hill  Rd., Washington  DC   ');
  assert.equal(normalized.queryText, '4600 Silver Hill road, Washington DC');
  assert.equal(normalized.cacheKey, `addr:${normalized.queryText.toUpperCase()}`);
});

test('expandCommonAbbreviations only touches whole-word abbreviations, never mid-word letters', () => {
  assert.equal(expandCommonAbbreviations('123 Main St'), '123 Main street');
  assert.equal(expandCommonAbbreviations('Reston'), 'Reston');
});

test('coordinateCacheKey rounds to bound cache cardinality without colliding across distinct points', () => {
  const a = coordinateCacheKey(38.846011, -76.927011);
  const b = coordinateCacheKey(38.846019, -76.927019);
  const c = coordinateCacheKey(41.88, -87.63);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('evaluateGeocodeProductScope accepts the 50-states-+-D.C. scope and rejects a territory', () => {
  assert.deepEqual(evaluateGeocodeProductScope(DC_MATCH), { inScope: true });
  assert.deepEqual(evaluateGeocodeProductScope(TERRITORY_MATCH), {
    inScope: false,
    reason: 'territory_out_of_scope',
  });
  assert.deepEqual(evaluateGeocodeProductScope({ lat: 0, lng: 0 }), {
    inScope: false,
    reason: 'no_state_resolved',
  });
});

test('geoPrecisionTierForMatch ranks a matched address as exact-site and a bare state as state', () => {
  assert.equal(geoPrecisionTierForMatch(DC_MATCH), 'exact-site');
  assert.equal(geoPrecisionTierForMatch({ lat: 0, lng: 0, stateFips: '11' }), 'state');
  assert.equal(geoPrecisionTierForMatch({ lat: 0, lng: 0 }), 'state');
});

test('reduceGeocodeCoordinatePrecision drops the exact coordinate by default (fail-safe)', () => {
  const reduced = reduceGeocodeCoordinatePrecision({ match: DC_MATCH, tier: 'exact-site' });
  assert.equal(reduced.exactCoordinatesRetained, false);
  assert.equal(reduced.lat, undefined);
  assert.equal(reduced.lng, undefined);
});

test('reduceGeocodeCoordinatePrecision retains the coordinate only when explicitly opted in for a fine tier', () => {
  const retained = reduceGeocodeCoordinatePrecision({
    match: DC_MATCH,
    tier: 'exact-site',
    retainExactCoordinates: true,
  });
  assert.equal(retained.exactCoordinatesRetained, true);
  assert.equal(retained.lat, DC_MATCH.lat);

  const stillReduced = reduceGeocodeCoordinatePrecision({
    match: DC_MATCH,
    tier: 'county',
    retainExactCoordinates: true,
  });
  assert.equal(
    stillReduced.exactCoordinatesRetained,
    false,
    'county tier never retains an exact point',
  );
});

test('buildManualPlaceSearchFallback is always available and defaults to /search', () => {
  const fallback = buildManualPlaceSearchFallback('geocoder_unavailable');
  assert.equal(fallback.available, true);
  assert.equal(fallback.searchHref, '/search');
  assert.match(fallback.message, /temporarily unavailable/);
});

test('geocodeAddress resolves jurisdiction ids without exact coordinates by default', async () => {
  const result = await geocodeAddress({
    address: '4600 Silver Hill Rd, Washington, DC 20233',
    fetchAddressGeocode: async () => [DC_MATCH],
  });
  assert.ok(result.ok);
  const success = result as Extract<GeocodeResult, { ok: true }>;
  assert.equal(success.resolution.jurisdictionIds.stateId, 'us-11');
  assert.equal(success.resolution.jurisdictionIds.countyId, 'us-11-001');
  assert.equal(success.resolution.precision.exactCoordinatesRetained, false);
  assert.equal(success.resolution.precision.lat, undefined);
  assert.equal(
    (success.resolution.match as { lat?: number }).lat,
    undefined,
    'match summary must not carry a coordinate',
  );
  assert.equal(success.cacheHit, false);
});

test('geocodeAddress falls back to manual search on an empty/blank address', async () => {
  const result = await geocodeAddress({
    address: '   ',
    fetchAddressGeocode: async () => [DC_MATCH],
  });
  assert.equal(result.ok, false);
  assert.equal((result as Extract<GeocodeResult, { ok: false }>).fallback.reason, 'no_match');
});

test('geocodeAddress falls back to manual search when the fetcher throws (geocoder failure)', async () => {
  const result = await geocodeAddress({
    address: '123 Main St',
    fetchAddressGeocode: async () => {
      throw new Error('upstream unavailable');
    },
  });
  assert.equal(result.ok, false);
  assert.equal(
    (result as Extract<GeocodeResult, { ok: false }>).fallback.reason,
    'geocoder_unavailable',
  );
});

test('geocodeAddress falls back to manual search on no matches and on an out-of-scope territory', async () => {
  const noMatch = await geocodeAddress({
    address: 'nowhere at all',
    fetchAddressGeocode: async () => [],
  });
  assert.equal((noMatch as Extract<GeocodeResult, { ok: false }>).fallback.reason, 'no_match');

  const territory = await geocodeAddress({
    address: '1 Calle Principal, San Juan, PR',
    fetchAddressGeocode: async () => [TERRITORY_MATCH],
  });
  assert.equal((territory as Extract<GeocodeResult, { ok: false }>).fallback.reason, 'no_match');
});

test('geocodeAddress falls back on an ambiguous (multi-)match rather than guessing', async () => {
  const result = await geocodeAddress({
    address: 'Main St',
    fetchAddressGeocode: async () => [DC_MATCH, { ...DC_MATCH, placeFips: '99999' }],
  });
  assert.equal(
    (result as Extract<GeocodeResult, { ok: false }>).fallback.reason,
    'ambiguous_match',
  );
});

test('geocodeAddress reuses a cached resolution on the second call without re-invoking the fetcher', async () => {
  const cache = createGeocodeCache<GeocodeResolution>();
  let calls = 0;
  const fetchAddressGeocode = async () => {
    calls += 1;
    return [DC_MATCH];
  };

  const first = await geocodeAddress({
    address: '4600 Silver Hill Rd',
    fetchAddressGeocode,
    cache,
    now: () => 0,
  });
  const second = await geocodeAddress({
    address: '4600 Silver Hill Rd',
    fetchAddressGeocode,
    cache,
    now: () => 0,
  });

  assert.equal(calls, 1, 'the fetcher must only be called once');
  assert.equal((first as Extract<GeocodeResult, { ok: true }>).cacheHit, false);
  assert.equal((second as Extract<GeocodeResult, { ok: true }>).cacheHit, true);
});

test('reverseGeocodeCoordinates never retains an exact coordinate even implicitly', async () => {
  const result = await reverseGeocodeCoordinates({
    lat: 38.846,
    lng: -76.927,
    fetchCoordinatesGeocode: async () => ({
      lat: 38.846,
      lng: -76.927,
      stateFips: '11',
      countyFips3: '001',
    }),
  });
  assert.ok(result.ok);
  const success = result as Extract<GeocodeResult, { ok: true }>;
  assert.equal(success.resolution.precision.exactCoordinatesRetained, false);
  assert.equal(success.resolution.jurisdictionIds.countyId, 'us-11-001');
});

test('reverseGeocodeCoordinates falls back to manual search when the reverse fetcher fails', async () => {
  const result = await reverseGeocodeCoordinates({
    lat: 38.846,
    lng: -76.927,
    fetchCoordinatesGeocode: async () => {
      throw new Error('network error');
    },
  });
  assert.equal(result.ok, false);
  assert.equal(
    (result as Extract<GeocodeResult, { ok: false }>).fallback.reason,
    'geocoder_unavailable',
  );
});

test('normalizeUsZipInput accepts 5-digit ZIP and ZIP+4 bases', () => {
  assert.equal(normalizeUsZipInput('46202'), '46202');
  assert.equal(normalizeUsZipInput('46202-1234'), '46202');
  assert.equal(normalizeUsZipInput(' 60601 '), '60601');
  assert.equal(normalizeUsZipInput('not-a-zip'), undefined);
});

test('isUsZipOnlyInput is true only for standalone postal codes', () => {
  assert.equal(isUsZipOnlyInput('10001'), true);
  assert.equal(isUsZipOnlyInput('10001-0001'), true);
  assert.equal(isUsZipOnlyInput('Indianapolis, IN 46202'), false);
});

test('lookupUsZipCentroid resolves known U.S. ZIP centroids', () => {
  const hit = lookupUsZipCentroid('46202');
  assert.ok(hit);
  assert.equal(hit!.zip5, '46202');
  assert.ok(Number.isFinite(hit!.lat));
  assert.ok(Number.isFinite(hit!.lng));
  assert.equal(hit!.city, 'Indianapolis');
  assert.equal(hit!.stateAbbrev, 'IN');
});

test('translateZipToPlace resolves jurisdiction ids and never echoes the raw ZIP back', async () => {
  const result = await translateZipToPlace({
    zip: '20233',
    lookupZipCentroid: () => ({ zip5: '20233', lat: 38.846, lng: -76.927, city: 'Washington' }),
    fetchCoordinatesGeocode: async () => DC_MATCH,
  });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.placeName, 'Washington');
    assert.equal(result.jurisdictionIds.stateId, 'us-11');
    assert.ok(!('zip' in result), 'translate-then-discard: the ZIP must not appear on the result');
  }
});

test('translateZipToPlace rejects a malformed ZIP without calling the fetcher', async () => {
  let called = false;
  const result = await translateZipToPlace({
    zip: 'not-a-zip',
    lookupZipCentroid: () => ({ zip5: '20233', lat: 38.846, lng: -76.927 }),
    fetchCoordinatesGeocode: async () => {
      called = true;
      return DC_MATCH;
    },
  });
  assert.equal(result.ok, false);
  assert.equal(called, false);
});

test('translateZipToPlace falls back to manual search when the centroid is unknown', async () => {
  const result = await translateZipToPlace({
    zip: '00000',
    lookupZipCentroid: () => undefined,
    fetchCoordinatesGeocode: async () => DC_MATCH,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.fallback.reason, 'no_match');
  }
});

test('translateZipToPlace falls back when Census reverse geocode fails for the centroid', async () => {
  const result = await translateZipToPlace({
    zip: '46202',
    lookupZipCentroid: () => ({ zip5: '46202', lat: 39.7851, lng: -86.1595 }),
    fetchCoordinatesGeocode: async () => {
      throw new Error('network error');
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.fallback.reason, 'geocoder_unavailable');
  }
});

test('buildCoarseLocationAnalyticsEvent never carries a coordinate, address, or ZIP field', async () => {
  const result = await geocodeAddress({
    address: '4600 Silver Hill Rd',
    fetchAddressGeocode: async () => [DC_MATCH],
  });
  assert.ok(result.ok);
  const event = buildCoarseLocationAnalyticsEvent(
    'geocode_resolved',
    (result as Extract<GeocodeResult, { ok: true }>).resolution,
    { now: () => '2026-07-17T00:00:00.000Z' },
  );
  assert.deepEqual(Object.keys(event).sort(), [
    'geoPrecisionTier',
    'jurisdictionId',
    'kind',
    'occurredAt',
  ]);
  assert.equal(event.jurisdictionId, 'us-11-001');
  assert.equal(event.geoPrecisionTier, 'exact-site');
});
