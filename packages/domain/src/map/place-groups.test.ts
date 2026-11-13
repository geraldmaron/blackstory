/**
 * Place grouping: every record is counted somewhere at every level, county records count in
 * their county (not their state), coincident sites spread deterministically, and no anchor is
 * taken from one record's raw point.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  breakdownInWords,
  buildPlaceGroups,
  cityFromJurisdictionLabel,
  pathIncludes,
  PLACE_KEY_PATTERN,
  PLACE_LEVEL_MIN_ZOOM,
  squareKey,
  SQUARE_STEP_DEG,
  type CountyRef,
  type PlaceLookups,
  type PlaceRecordInput,
} from './place-groups.js';

const FULTON: CountyRef = { fips: '13121', name: 'Fulton County', anchor: [-84.47, 33.79] };
const FORSYTH: CountyRef = { fips: '13117', name: 'Forsyth County', anchor: [-84.13, 34.23] };

const lookups: PlaceLookups = {
  // Fulton west of -84.3 and south of 34; Forsyth north of 34; nothing else resolves.
  countyAt: (lng, lat) => (lat >= 34 ? FORSYTH : lng < -84.3 ? FULTON : undefined),
  stateAnchor: (postal) => (postal === 'GA' ? [-83.4, 32.7] : undefined),
};

const ga = (record: Omit<PlaceRecordInput, 'statePostalCode' | 'stateName'>): PlaceRecordInput => ({
  ...record,
  statePostalCode: 'GA',
  stateName: 'Georgia',
});

const RECORDS: readonly PlaceRecordInput[] = [
  ga({
    id: 'b-site',
    lng: -84.39,
    lat: 33.75,
    precision: 'site',
    jurisdictionLabel: 'Atlanta, Georgia',
  }),
  ga({
    id: 'a-site',
    lng: -84.39,
    lat: 33.75,
    precision: 'address',
    jurisdictionLabel: 'Atlanta, GA',
  }),
  ga({
    id: 'c-city',
    lng: -84.388,
    lat: 33.749,
    precision: 'city',
    jurisdictionLabel: 'Atlanta, Georgia',
  }),
  // County precision whose label names a city: it must never be placed in that city.
  ga({
    id: 'd-county',
    lng: -84.1,
    lat: 34.2,
    precision: 'county',
    jurisdictionLabel: 'Cumming, Georgia',
  }),
  ga({ id: 'e-state', lng: -83.4, lat: 32.7, precision: 'state', jurisdictionLabel: 'Georgia' }),
];

test('every record is counted exactly once at every level', () => {
  const groups = buildPlaceGroups(RECORDS, lookups);
  for (const level of ['state', 'county', 'city', 'square'] as const) {
    const ids = groups.tokens
      .filter((t) => t.id.startsWith(`${level}:`))
      .flatMap((t) => t.memberIds);
    assert.deepEqual([...ids].sort(), RECORDS.map((r) => r.id).sort(), level);
  }
  // At the site level, sites draw on their own and the rest stay in tokens.
  const siteTokens = groups.tokens
    .filter((t) => t.id.startsWith('site:'))
    .flatMap((t) => t.memberIds);
  const drawn = groups.sites.map((s) => s.id);
  assert.deepEqual([...siteTokens, ...drawn].sort(), RECORDS.map((r) => r.id).sort());
});

test('a county record counts in its county, never in a city its label names', () => {
  const groups = buildPlaceGroups(RECORDS, lookups);
  const path = groups.pathById.get('d-county')!;
  assert.equal(path.county, 'county-13117');
  assert.equal(path.city, undefined);
  const cityLevel = groups.tokens.find((t) => t.id === 'city:county-13117');
  assert.deepEqual(cityLevel?.memberIds, ['d-county']);
  assert.equal(cityLevel?.name, 'Forsyth County, GA');
  assert.deepEqual(cityLevel?.anchor, FORSYTH.anchor);
});

test('a statewide record stays at the state anchor at every level', () => {
  const groups = buildPlaceGroups(RECORDS, lookups);
  const site = groups.tokens.find((t) => t.id === 'site:state-ga');
  assert.deepEqual(site?.memberIds, ['e-state']);
  assert.deepEqual(site?.anchor, [-83.4, 32.7]);
});

test('the state token carries the full precision mix in words', () => {
  const groups = buildPlaceGroups(RECORDS, lookups);
  const state = groups.tokens.find((t) => t.id === 'state:state-ga')!;
  assert.equal(
    breakdownInWords(state.breakdown),
    '2 sit at exact sites, 1 is placed within a city, 1 is known only by county, and 1 is known only by state',
  );
  assert.equal(
    breakdownInWords({ site: 1, area: 0, county: 3, state: 0 }),
    '1 sits at an exact site and 3 are known only by county',
  );
});

test('a city anchor comes from its city-scale records, rounded to city scale', () => {
  const groups = buildPlaceGroups(RECORDS, lookups);
  const atlanta = groups.places.get('city-ga-atlanta')!;
  assert.equal(atlanta.name, 'Atlanta, GA');
  assert.deepEqual(atlanta.anchor, [-84.38, 33.74]);
  assert.ok(pathIncludes(groups.pathById.get('a-site')!, 'county-13121'));
});

test('coincident sites spread in stable id order and keep their true point', () => {
  const groups = buildPlaceGroups(RECORDS, lookups);
  const again = buildPlaceGroups([...RECORDS].reverse(), lookups);
  assert.deepEqual(
    groups.sites,
    [...again.sites].sort((a, b) => (a.id < b.id ? -1 : 1)),
  );
  for (const site of groups.sites) {
    assert.deepEqual(site.truePoint, [-84.39, 33.75]);
    assert.notDeepEqual(site.drawnPoint, site.truePoint);
  }
});

test('without a county lookup, records fall back to their state', () => {
  const groups = buildPlaceGroups(RECORDS, { stateAnchor: lookups.stateAnchor });
  const county = groups.tokens.filter((t) => t.id.startsWith('county:'));
  assert.deepEqual(
    county.map((t) => t.placeKey),
    ['state-ga'],
  );
});

test('city parsing reads the segment before the state and refuses counties', () => {
  assert.equal(cityFromJurisdictionLabel('Harlem, New York City, New York', 'NY'), 'New York City');
  assert.equal(cityFromJurisdictionLabel('Southampton County, Virginia', 'VA'), undefined);
  assert.equal(cityFromJurisdictionLabel('Texas', 'TX'), undefined);
  assert.equal(cityFromJurisdictionLabel('Anything', 'DC'), 'Washington');
  assert.ok(PLACE_KEY_PATTERN.test('city-ga-atlanta'));
  assert.ok(!PLACE_KEY_PATTERN.test('city-GA-<x>'));
});

test('a dense city groups its sites into fixed grid squares, a lone site draws on its own', () => {
  const extra = [
    ga({
      id: 'f-site',
      lng: -84.327,
      lat: 33.712,
      precision: 'site',
      jurisdictionLabel: 'Atlanta, Georgia',
    }),
    ga({
      id: 'g-site',
      lng: -84.335,
      lat: 33.705,
      precision: 'site',
      jurisdictionLabel: 'Atlanta, Georgia',
    }),
    ga({
      id: 'h-site',
      lng: -84.2,
      lat: 33.6,
      precision: 'site',
      jurisdictionLabel: 'Atlanta, Georgia',
    }),
  ];
  const all = [...RECORDS, ...extra];
  const groups = buildPlaceGroups(all, lookups);
  const square = squareKey(-84.39, 33.75);
  assert.equal(square, 'square-4780-6187');
  assert.ok(PLACE_KEY_PATTERN.test(square));
  assert.equal(squareKey(-84.327, 33.712), squareKey(-84.335, 33.705));

  // Two shared squares, and the lone site stays out of every square.
  const squares = groups.tokens.filter((t) => t.id.startsWith('square:square-'));
  assert.deepEqual(squares.map((t) => [...t.memberIds].sort()).sort(), [
    ['a-site', 'b-site'],
    ['f-site', 'g-site'],
  ]);
  assert.equal(groups.pathById.get('h-site')!.square, undefined);
  assert.equal(groups.places.get(square)!.name, 'A square in Atlanta, GA');

  // The anchor is the square's fixed center, never a record's point.
  const anchor = groups.places.get(square)!.anchor;
  assert.ok(Math.abs((((anchor[0] + 180) / SQUARE_STEP_DEG) % 1) - 0.5) < 1e-6);
  const other = groups.places.get(squareKey(-84.327, 33.712))!.anchor;
  assert.deepEqual(other, [-84.33, 33.71]);
  assert.notDeepEqual(other, [-84.327, 33.712]);

  // Squares show between the city frame and the street; every record is counted once there.
  const band = squares[0]!;
  assert.equal(band.minZoom, PLACE_LEVEL_MIN_ZOOM.square);
  assert.equal(band.maxZoom, PLACE_LEVEL_MIN_ZOOM.site);
  const counted = groups.tokens
    .filter((t) => t.id.startsWith('square:'))
    .flatMap((t) => t.memberIds);
  assert.deepEqual([...counted, 'h-site'].sort(), all.map((r) => r.id).sort());

  // Selecting a square scopes to exactly its sites; city-scale records are never in a square.
  const inSquare = all
    .filter((r) => pathIncludes(groups.pathById.get(r.id)!, square))
    .map((r) => r.id);
  assert.deepEqual(inSquare.sort(), ['a-site', 'b-site']);
  assert.equal(groups.pathById.get('c-city')!.square, undefined);
});
