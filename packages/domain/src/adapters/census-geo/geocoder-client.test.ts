/**
 * Tests for the live Census Geocoder API adapter (BB-050) — URL building, defensive response
 * parsing, normalization to `CensusGeocodeMatch`, and the `SafeHttpClient`-based fetch wrapper.
 * Fixtures-first per this bead's mandate: `fetchCensusAddressGeocode` /
 * `fetchCensusCoordinatesGeocode` are exercised against a fake `SafeHttpClient` returning the
 * committed fixtures in `./fixtures/` — no live network call is made by this suite.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import type { SafeHttpResponse } from '../internet-archive/shared/http-port.js';
import { buildCensusCoordinatesUrl, buildCensusOneLineAddressUrl } from './url-builder.js';
import { parseCensusAddressGeocodeResponse, parseCensusCoordinatesGeocodeResponse } from './response-parser.js';
import { extractCensusGeography, normalizeCensusAddressMatch } from './normalizer.js';
import { fetchCensusAddressGeocode, fetchCensusCoordinatesGeocode } from './fetch-geocode.js';

const here = dirname(fileURLToPath(import.meta.url));
function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(here, 'fixtures', name), 'utf8'));
}

test('buildCensusOneLineAddressUrl pins benchmark/vintage and encodes the address', () => {
  const url = buildCensusOneLineAddressUrl({ address: '4600 Silver Hill Rd, Washington, DC 20233' });
  assert.match(url, /^https:\/\/geocoding\.geo\.census\.gov\/geocoder\/geographies\/onelineaddress\?/);
  assert.match(url, /benchmark=Public_AR_Current/);
  assert.match(url, /vintage=Current_Current/);
  assert.match(url, /address=4600\+Silver\+Hill/);
});

test('buildCensusOneLineAddressUrl rejects an empty address', () => {
  assert.throws(() => buildCensusOneLineAddressUrl({ address: '   ' }));
});

test('buildCensusCoordinatesUrl encodes x=lng, y=lat and rejects out-of-range values', () => {
  const url = buildCensusCoordinatesUrl({ lat: 41.8756, lng: -87.6244 });
  assert.match(url, /x=-87\.6244/);
  assert.match(url, /y=41\.8756/);
  assert.throws(() => buildCensusCoordinatesUrl({ lat: 999, lng: -87.6244 }));
  assert.throws(() => buildCensusCoordinatesUrl({ lat: 41.8756, lng: 999 }));
});

test('parseCensusAddressGeocodeResponse extracts one match with geographies from the fixture', () => {
  const matches = parseCensusAddressGeocodeResponse(loadFixture('onelineaddress-match.json'));
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.coordinates?.x, -76.92748724230096);
  assert.equal(matches[0]?.geographies?.States?.[0]?.STATE, '11');
});

test('parseCensusAddressGeocodeResponse returns an empty array for a no-match response', () => {
  const matches = parseCensusAddressGeocodeResponse(loadFixture('onelineaddress-no-match.json'));
  assert.deepEqual(matches, []);
});

test('parseCensusAddressGeocodeResponse never throws on a malformed/unexpected shape', () => {
  assert.deepEqual(parseCensusAddressGeocodeResponse(null), []);
  assert.deepEqual(parseCensusAddressGeocodeResponse({}), []);
  assert.deepEqual(parseCensusAddressGeocodeResponse({ result: { addressMatches: 'not-an-array' } }), []);
});

test('parseCensusCoordinatesGeocodeResponse extracts the geographies block from the fixture', () => {
  const geographies = parseCensusCoordinatesGeocodeResponse(loadFixture('coordinates-geographies.json'));
  assert.equal(geographies?.Counties?.[0]?.COUNTY, '031');
});

test('extractCensusGeography reads state/county/place FIPS and names from the fixture geographies', () => {
  const matches = parseCensusAddressGeocodeResponse(loadFixture('onelineaddress-match.json'));
  const geography = extractCensusGeography(matches[0]?.geographies);
  assert.deepEqual(geography, {
    stateFips: '11',
    stateName: 'District of Columbia',
    countyFips3: '001',
    countyName: 'District of Columbia',
    placeFips: '50000',
    placeName: 'Washington',
  });
});

test('normalizeCensusAddressMatch maps Census coordinates.x/y to lng/lat and carries the transient zip', () => {
  const matches = parseCensusAddressGeocodeResponse(loadFixture('onelineaddress-match.json'));
  const normalized = normalizeCensusAddressMatch(matches[0]!);
  assert.equal(normalized?.lat, 38.84601622386617);
  assert.equal(normalized?.lng, -76.92748724230096);
  assert.equal(normalized?.zip, '20233');
  assert.equal(normalized?.stateFips, '11');
  assert.equal(normalized?.matchedAddress, '4600 SILVER HILL RD, WASHINGTON, DC, 20233');
});

test('normalizeCensusAddressMatch returns undefined when the raw match has no coordinates', () => {
  assert.equal(normalizeCensusAddressMatch({ matchedAddress: 'no coords' }), undefined);
});

function fakeClient(body: unknown): (request: { readonly url: string }) => Promise<SafeHttpResponse> {
  return async (request) => ({
    status: 200,
    headers: { 'content-type': 'application/json' },
    bodyText: JSON.stringify(body),
    finalUrl: request.url,
  });
}

test('fetchCensusAddressGeocode returns normalized matches through the SafeHttpClient port', async () => {
  const matches = await fetchCensusAddressGeocode({
    address: '4600 Silver Hill Rd, Washington, DC 20233',
    client: fakeClient(loadFixture('onelineaddress-match.json')),
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.countyName, 'District of Columbia');
  assert.equal(matches[0]?.placeName, 'Washington');
});

test('fetchCensusAddressGeocode returns an empty array for a no-match response (never throws)', async () => {
  const matches = await fetchCensusAddressGeocode({
    address: 'not a real address, nowhere, ZZ 00000',
    client: fakeClient(loadFixture('onelineaddress-no-match.json')),
  });
  assert.deepEqual(matches, []);
});

test('fetchCensusCoordinatesGeocode returns the FIPS geography containing the reverse-geocoded point', async () => {
  const match = await fetchCensusCoordinatesGeocode({
    lat: 41.8756,
    lng: -87.6244,
    client: fakeClient(loadFixture('coordinates-geographies.json')),
  });
  assert.equal(match.stateFips, '17');
  assert.equal(match.countyFips3, '031');
  assert.equal(match.placeName, 'Chicago');
  assert.equal(match.lat, 41.8756);
  assert.equal(match.lng, -87.6244);
});

test('fetchCensusAddressGeocode rejects a disallowed content type (fail closed)', async () => {
  const client = async (request: { readonly url: string }): Promise<SafeHttpResponse> => ({
    status: 200,
    headers: { 'content-type': 'text/html' },
    bodyText: '<html>not json</html>',
    finalUrl: request.url,
  });
  await assert.rejects(() => fetchCensusAddressGeocode({ address: '123 Main St', client, retries: 0 }));
});
