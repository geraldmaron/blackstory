/**
 * Demo/test fixtures for the map data platform. There is no live Firebase
 * release yet (apps/web reads `src/data/public-seed.ts` fixtures the same way),
 * so this module is the map-source equivalent: raw (pre-redaction) entity +
 * location inputs spanning several states, including the critical negative-case
 * fixture — a living person with a precise residential coordinate — used by the
 * redaction regression test and by the `/map` demo route.
 *
 * Shapes mirror `packages/firebase/fixtures/firestore-seed.ts` in spirit but are
 * independent.
 */
import type { MapSourceEntityInput } from './map-source.js';

/** Public place/school entities safe, coarse precision, no living-person risk. */
export const PLACE_DC_FIXTURE: MapSourceEntityInput = {
  entityId: 'ent_fixture_place_dc',
  kind: 'place',
  displayName: 'Seed Historical Place (D.C.)',
  livingStatus: 'unknown',
  location: {
    precision: 'city',
    lat: 38.9072,
    lng: -77.0369,
    geohash: 'dqcjqcpe4',
    matchMethod: 'manual_research',
    label: 'Washington, D.C.',
  },
};

export const SCHOOL_DC_FIXTURE: MapSourceEntityInput = {
  entityId: 'ent_fixture_school_dc',
  kind: 'school',
  displayName: 'Seed Freedmen School (D.C.)',
  livingStatus: 'unknown',
  location: {
    precision: 'campus',
    lat: 38.9101,
    lng: -77.0147,
    geohash: 'dqcjr1x8k',
    matchMethod: 'geocode_other',
    label: 'Current campus',
  },
};

// Queens coordinates are used deliberately (rather than Lower Manhattan) see
// us-geography.test.ts "documented limitation": Manhattan's lng/lat also falls
// inside New Jersey's approximate bounding box and would misattribute there.
export const PLACE_HARLEM_NY_FIXTURE: MapSourceEntityInput = {
  entityId: 'ent_fixture_place_harlem_ny',
  kind: 'place',
  displayName: 'Seed Cultural Institution (Queens, NY)',
  livingStatus: 'unknown',
  location: {
    precision: 'neighborhood',
    lat: 40.7282,
    lng: -73.7949,
    geohash: 'dr5rux3q1',
    matchMethod: 'manual_research',
    label: 'Queens',
    county: { name: 'Queens County', fipsCode: '36081' },
  },
};

export const INSTITUTION_NYC_NY_FIXTURE: MapSourceEntityInput = {
  entityId: 'ent_fixture_institution_nyc_ny',
  kind: 'institution',
  displayName: 'Seed Civic Institution (Queens, NY)',
  livingStatus: 'unknown',
  location: {
    precision: 'city',
    lat: 40.7769,
    lng: -73.874,
    geohash: 'dr5ry3z1a',
    matchMethod: 'manual_research',
    label: 'Queens, NY',
    county: { name: 'Queens County', fipsCode: '36081' },
  },
};

/** Sensitive site: allowed source precision, but capped by sensitivityClass. */
export const INSTITUTION_ATLANTA_GA_SENSITIVE_FIXTURE: MapSourceEntityInput = {
  entityId: 'ent_fixture_institution_atl_ga',
  kind: 'institution',
  displayName: 'Seed Sensitive Site (Atlanta, GA)',
  livingStatus: 'unknown',
  location: {
    precision: 'institution',
    lat: 33.749,
    lng: -84.388,
    geohash: 'djfrz2h1n',
    matchMethod: 'manual_research',
    sensitivityClass: 'sensitive_site',
    label: 'Atlanta institution campus',
  },
};

export const PLACE_CALIFORNIA_STATE_FIXTURE: MapSourceEntityInput = {
  entityId: 'ent_fixture_place_ca_state',
  kind: 'place',
  displayName: 'Seed Statewide Reference (California)',
  livingStatus: 'unknown',
  location: {
    precision: 'state',
    lat: 34.0522,
    lng: -118.2437,
    geohash: '9q5',
    matchMethod: 'manual_research',
  },
};

/** No geographic anchor at all must be excluded, not silently coarsened. */
export const EVENT_NO_LOCATION_FIXTURE: MapSourceEntityInput = {
  entityId: 'ent_fixture_event_no_location',
  kind: 'event',
  displayName: 'Seed Event (no geographic anchor)',
  livingStatus: 'unknown',
};

/**
 * THE CRITICAL FIXTURE:
 * a living person with a precise residential coordinate. `redactLocationForPublic`
 * must coarsen this to city precision (per the constitution's
 * `livingResidenceMaxPublicPrecision`) — the exact residential lat/lng below must
 * never appear in generated map output.
 */
export const LIVING_PERSON_RESIDENCE_FIXTURE: MapSourceEntityInput = {
  entityId: 'ent_fixture_person_living_houston_tx',
  kind: 'person',
  displayName: 'Seed Living Person (Houston, TX)',
  livingStatus: 'living',
  location: {
    precision: 'street_address',
    lat: 29.760427,
    lng: -95.369803,
    geohash: '9vk1p1n8x',
    matchMethod: 'geocode_other',
    label: '123 Bayou Street, Houston, TX',
  },
};

/** Second negative case: unknown living status defaults to "treat as living". */
export const UNKNOWN_LIVING_STATUS_EXACT_COORDINATES_FIXTURE: MapSourceEntityInput = {
  entityId: 'ent_fixture_person_unknown_living_chicago_il',
  kind: 'person',
  displayName: 'Seed Person, Unknown Living Status (Chicago, IL)',
  location: {
    precision: 'exact_coordinates',
    lat: 41.878114,
    lng: -87.629798,
    geohash: 'dp3wjzquj',
    matchMethod: 'geocode_other',
    sensitivityClass: 'living_residence',
  },
};

/** Third negative case: deceased person's historical residence is still reduced, not raw. */
export const DECEASED_RESIDENCE_FIXTURE: MapSourceEntityInput = {
  entityId: 'ent_fixture_person_deceased_residence_kc_mo',
  kind: 'person',
  displayName: 'Seed Deceased Person, Historical Residence (Kansas City, MO)',
  livingStatus: 'deceased',
  location: {
    precision: 'street_address',
    lat: 39.0997,
    lng: -94.5786,
    geohash: '9yuxb8vfh',
    matchMethod: 'manual_research',
    occupiedPrivateResidence: false,
  },
};

/** Full demo/test population everything-active fixture set across 7 states + D.C. */
export const MAP_SOURCE_DEMO_FIXTURES: readonly MapSourceEntityInput[] = [
  PLACE_DC_FIXTURE,
  SCHOOL_DC_FIXTURE,
  PLACE_HARLEM_NY_FIXTURE,
  INSTITUTION_NYC_NY_FIXTURE,
  INSTITUTION_ATLANTA_GA_SENSITIVE_FIXTURE,
  PLACE_CALIFORNIA_STATE_FIXTURE,
  EVENT_NO_LOCATION_FIXTURE,
  LIVING_PERSON_RESIDENCE_FIXTURE,
  UNKNOWN_LIVING_STATUS_EXACT_COORDINATES_FIXTURE,
  DECEASED_RESIDENCE_FIXTURE,
];
