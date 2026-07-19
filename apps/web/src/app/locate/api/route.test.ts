/**
 * Integration tests for the public `/locate` geocode route. These exercise the REAL
 * route handler end-to-end App Check guard, `geocoding` rate limiter, address/ZIP/
 * coordinate parsing, and the full geocode pipeline (`../../../lib/geocode/pipeline.ts`) with a
 * fake Census fetcher injected so no real network call is ever made (style follows
 * `../../search/api/route.test.ts`: plain `node:test`, real objects, no mocking framework).
 *
 * Covers territory scope, exact coordinates never leaving the resolution, manual-place-search
 * fallback on geocoder failure/no-match/ambiguous match, rate limiting, and jurisdiction-id +
 * ZIP-translate-then-discard resolution.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppCheckVerifier } from '@repo/firebase';
import type { CensusGeocodeMatch } from '@repo/domain';
import { createLocateCache } from '../../../lib/geocode/pipeline';
import { createLocateAppCheckGuard } from './app-check-guard';
import { createLocateRateLimitGuard } from './rate-limit-guard';
import { handleLocateRequest, type LocateRouteDependencies } from './handler';

function acceptingVerifier(appId = 'test-app-id'): AppCheckVerifier {
  return {
    async verifyToken() {
      return { appId };
    },
  };
}

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

const PUERTO_RICO_MATCH: CensusGeocodeMatch = {
  matchedAddress: '1 CALLE SOL, SAN JUAN, PR, 00901',
  lat: 18.466,
  lng: -66.105,
  stateFips: '72',
  stateName: 'Puerto Rico',
  countyFips3: '127',
  countyName: 'San Juan Municipio',
};

function fakeAddressFetcher(
  result: readonly CensusGeocodeMatch[] | (() => readonly CensusGeocodeMatch[]),
) {
  return async (): Promise<readonly CensusGeocodeMatch[]> =>
    typeof result === 'function' ? result() : result;
}

function fakeCoordinatesFetcher(result: CensusGeocodeMatch | (() => CensusGeocodeMatch)) {
  return async (): Promise<CensusGeocodeMatch> =>
    typeof result === 'function' ? result() : result;
}

async function buildDeps(
  overrides: Partial<LocateRouteDependencies> = {},
): Promise<LocateRouteDependencies> {
  const appCheckGuard = await createLocateAppCheckGuard({
    mode: 'enforce',
    verifier: acceptingVerifier(),
    telemetry: { record: () => {} },
  });
  return {
    appCheckGuard,
    rateLimitGuard: createLocateRateLimitGuard({ now: () => 0 }),
    cache: createLocateCache(),
    ...overrides,
  };
}

function locateRequest(query: string, opts: { appCheck?: boolean } = {}): Request {
  const headers: Record<string, string> = {};
  if (opts.appCheck !== false) headers['x-firebase-appcheck'] = 'a-real-looking-token';
  return new Request(`http://localhost/locate/api${query}`, { headers });
}

type LocateSuccessBody = {
  readonly ok: true;
  readonly cacheHit: boolean;
  readonly resolution: {
    readonly match: { readonly placeName?: string; readonly stateName?: string };
    readonly jurisdictionIds: {
      readonly countryId: string;
      readonly stateId?: string;
      readonly countyId?: string;
    };
    readonly precision: {
      readonly tier: string;
      readonly exactCoordinatesRetained: boolean;
      readonly lat?: number;
      readonly lng?: number;
    };
  };
};

type LocateFailureBody = {
  readonly ok: false;
  readonly fallback: {
    readonly available: true;
    readonly reason: string;
    readonly searchHref: string;
  };
};

test('resolves a real address to jurisdiction ids with exact coordinates dropped (AC3, AC6)', async () => {
  const deps = await buildDeps({ fetchAddressGeocode: fakeAddressFetcher([DC_MATCH]) });
  const response = await handleLocateRequest(
    locateRequest('?address=4600+Silver+Hill+Rd%2C+Washington%2C+DC+20233'),
    deps,
  );
  assert.equal(response.status, 200);

  const body = (await response.json()) as LocateSuccessBody;
  assert.equal(body.ok, true);
  assert.equal(body.resolution.jurisdictionIds.countryId, 'us');
  assert.equal(body.resolution.jurisdictionIds.stateId, 'us-11');
  assert.equal(body.resolution.jurisdictionIds.countyId, 'us-11-001');
  assert.equal(body.resolution.precision.exactCoordinatesRetained, false);
  assert.equal(body.resolution.precision.lat, undefined, 'exact lat must not leak once reduced');
  assert.equal(body.resolution.precision.lng, undefined, 'exact lng must not leak once reduced');
});

test('a ZIP input resolves to a place and never echoes the ZIP back (AC6 translate-then-discard)', async () => {
  const deps = await buildDeps({ fetchAddressGeocode: fakeAddressFetcher([DC_MATCH]) });
  const response = await handleLocateRequest(locateRequest('?address=20233'), deps);
  assert.equal(response.status, 200);

  const raw = await response.text();
  assert.doesNotMatch(raw, /20233/, 'the raw ZIP must not appear anywhere in the response body');
  const body = JSON.parse(raw) as LocateSuccessBody;
  assert.equal(body.resolution.jurisdictionIds.stateId, 'us-11');
});

test('reverse-geocodes browser coordinates to jurisdiction ids (AC6)', async () => {
  const deps = await buildDeps({ fetchCoordinatesGeocode: fakeCoordinatesFetcher(DC_MATCH) });
  const response = await handleLocateRequest(locateRequest('?lat=38.846&lng=-76.927'), deps);
  assert.equal(response.status, 200);

  const body = (await response.json()) as LocateSuccessBody;
  assert.equal(body.ok, true);
  assert.equal(body.resolution.jurisdictionIds.stateId, 'us-11');
});

test('a Puerto Rico match is out of the 50-states-+-D.C. scope and falls back to manual search (AC1, AC4)', async () => {
  const deps = await buildDeps({ fetchAddressGeocode: fakeAddressFetcher([PUERTO_RICO_MATCH]) });
  const response = await handleLocateRequest(
    locateRequest('?address=1+Calle+Sol%2C+San+Juan%2C+PR'),
    deps,
  );
  assert.equal(response.status, 200);

  const body = (await response.json()) as LocateFailureBody;
  assert.equal(body.ok, false);
  assert.equal(body.fallback.available, true);
  assert.equal(body.fallback.searchHref, '/search');
});

test('a no-match geocoder response falls back to manual place search (AC4)', async () => {
  const deps = await buildDeps({ fetchAddressGeocode: fakeAddressFetcher([]) });
  const response = await handleLocateRequest(locateRequest('?address=nowhere+at+all'), deps);
  assert.equal(response.status, 200);

  const body = (await response.json()) as LocateFailureBody;
  assert.equal(body.ok, false);
  assert.equal(body.fallback.reason, 'no_match');
});

test('an ambiguous (multi-match) geocoder response falls back to manual place search (AC4)', async () => {
  const deps = await buildDeps({
    fetchAddressGeocode: fakeAddressFetcher([DC_MATCH, PUERTO_RICO_MATCH]),
  });
  const response = await handleLocateRequest(locateRequest('?address=main+st'), deps);
  assert.equal(response.status, 200);

  const body = (await response.json()) as LocateFailureBody;
  assert.equal(body.ok, false);
  assert.equal(body.fallback.reason, 'ambiguous_match');
});

test('a geocoder network failure falls back to manual place search, never a 5xx (AC4)', async () => {
  const deps = await buildDeps({
    fetchAddressGeocode: async () => {
      throw new Error('simulated network failure');
    },
  });
  const response = await handleLocateRequest(locateRequest('?address=123+Main+St'), deps);
  assert.equal(response.status, 200);

  const body = (await response.json()) as LocateFailureBody;
  assert.equal(body.ok, false);
  assert.equal(body.fallback.reason, 'geocoder_unavailable');
});

test('rejects a request with neither address nor coordinates (400)', async () => {
  const deps = await buildDeps();
  const response = await handleLocateRequest(locateRequest(''), deps);
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string; reason: string };
  assert.equal(body.error, 'invalid_locate_query');
  assert.equal(body.reason, 'exactly_one_of_address_or_coordinates_required');
});

test('rejects out-of-range coordinates (400)', async () => {
  const deps = await buildDeps();
  const response = await handleLocateRequest(locateRequest('?lat=999&lng=-76.927'), deps);
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string; reason: string };
  assert.equal(body.reason, 'coordinates_out_of_range');
});

test('a missing App Check token is denied (401 app_check_required)', async () => {
  const deps = await buildDeps({ fetchAddressGeocode: fakeAddressFetcher([DC_MATCH]) });
  const response = await handleLocateRequest(
    locateRequest('?address=4600+Silver+Hill+Rd', { appCheck: false }),
    deps,
  );
  assert.equal(response.status, 401);
  const body = (await response.json()) as { error: string; reason: string };
  assert.equal(body.error, 'app_check_required');
  assert.equal(body.reason, 'missing_token');
});

test('repeated calls exhaust the geocoding rate limit and are denied (429, AC5)', async () => {
  // Anonymous `geocoding` rolling-window cap is 5 (stricter than search's 8); on a fixed clock no
  // tokens refill, so the 6th call in the window must be denied.
  const deps = await buildDeps({ fetchAddressGeocode: fakeAddressFetcher([DC_MATCH]) });
  for (let i = 0; i < 5; i += 1) {
    const ok = await handleLocateRequest(locateRequest(`?address=query+${i}`), deps);
    assert.equal(ok.status, 200, `call ${i + 1} should be allowed`);
  }

  const denied = await handleLocateRequest(locateRequest('?address=query+overflow'), deps);
  assert.equal(denied.status, 429);
  const body = (await denied.json()) as { error: string };
  assert.equal(body.error, 'rate_limit_exceeded');
});

test('identical repeated address lookups are served from cache, not the fetcher (AC5 cached)', async () => {
  let callCount = 0;
  const deps = await buildDeps({
    fetchAddressGeocode: fakeAddressFetcher(() => {
      callCount += 1;
      return [DC_MATCH];
    }),
  });

  const first = await handleLocateRequest(locateRequest('?address=4600+Silver+Hill+Rd'), deps);
  const firstBody = (await first.json()) as LocateSuccessBody;
  assert.equal(firstBody.cacheHit, false);

  const second = await handleLocateRequest(locateRequest('?address=4600+silver+hill+rd'), deps);
  const secondBody = (await second.json()) as LocateSuccessBody;
  assert.equal(secondBody.cacheHit, true, 'case/whitespace-insensitive cache key should hit');
  assert.equal(callCount, 1, 'the underlying Census fetcher must be called exactly once');
});
