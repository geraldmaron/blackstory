/**
 * Unit tests for deterministic location-evidence classification and correction decisions.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildLocationGeocodeQuery,
  classifyLocationEvidence,
  decideLocationCorrection,
  driftThresholdMeters,
  suggestedPrecisionForEvidence,
} from './location-audit.js';

test('classifyLocationEvidence detects street addresses', () => {
  assert.equal(
    classifyLocationEvidence({
      locationLabel: '1530 6th Avenue North at 16th Street, Birmingham Civil Rights District',
      locationPrecision: 'institution',
    }),
    'street_address',
  );
});

test('classifyLocationEvidence treats city precision as area_only', () => {
  assert.equal(
    classifyLocationEvidence({
      locationLabel: 'Denver, Colorado',
      locationPrecision: 'city',
    }),
    'area_only',
  );
});

test('classifyLocationEvidence treats campus names as named_place', () => {
  assert.equal(
    classifyLocationEvidence({
      locationLabel: 'Howard University, Washington, D.C.',
      locationPrecision: 'campus',
    }),
    'named_place',
  );
});

test('driftThresholdMeters maps neighborhood to ~1 mile', () => {
  assert.equal(driftThresholdMeters('neighborhood'), 1600);
  assert.equal(driftThresholdMeters('institution'), 150);
});

test('suggestedPrecisionForEvidence downgrades unsupported institution claims', () => {
  assert.equal(suggestedPrecisionForEvidence('area_only', 'institution'), 'city');
  assert.equal(suggestedPrecisionForEvidence('street_address', 'city'), 'institution');
});

test('decideLocationCorrection keeps area-only without sharpening', () => {
  const decision = decideLocationCorrection({
    entityId: 'ent_x',
    locationLabel: 'Cleveland, Ohio',
    locationPrecision: 'city',
    jurisdictionLabel: 'Cleveland, Ohio',
    stored: { lat: 41.4997, lng: -81.6937 },
    geocode: {
      lat: 41.5,
      lng: -81.7,
      method: 'geocode_census',
      stateName: 'Ohio',
    },
  });
  assert.equal(decision.action, 'keep');
  assert.equal(decision.evidenceClass, 'area_only');
});

test('decideLocationCorrection corrects street-address drift beyond threshold', () => {
  const decision = decideLocationCorrection({
    entityId: 'ent_y',
    locationLabel: '12300 South Kedzie Avenue, Alsip, Illinois',
    locationPrecision: 'institution',
    jurisdictionLabel: 'Alsip, Illinois',
    stored: { lat: 41.6722, lng: -87.705 },
    geocode: {
      lat: 41.66747,
      lng: -87.70002,
      matchedAddress: '12300 S KEDZIE AVE, ALSIP, IL, 60803',
      stateName: 'Illinois',
      method: 'geocode_census',
    },
  });
  assert.equal(decision.action, 'correct_coordinates');
  assert.ok(decision.driftMeters && decision.driftMeters > 150);
  assert.deepEqual(decision.corrected, { lat: 41.66747, lng: -87.70002 });
});

test('decideLocationCorrection keeps street-address within threshold', () => {
  const decision = decideLocationCorrection({
    entityId: 'ent_z',
    locationLabel: '1518 M Street NW, Washington, D.C.',
    locationPrecision: 'institution',
    jurisdictionLabel: 'Washington, District of Columbia',
    stored: { lat: 38.9058, lng: -77.0356 },
    geocode: {
      lat: 38.90559,
      lng: -77.03498,
      matchedAddress: '1518 M ST NW, WASHINGTON, DC, 20005',
      stateName: 'District of Columbia',
      method: 'geocode_census',
    },
  });
  assert.equal(decision.action, 'keep');
});

test('decideLocationCorrection reviews huge named-place disagreement', () => {
  const decision = decideLocationCorrection({
    entityId: 'ent_afb',
    locationLabel: 'Edwards Air Force Base, California',
    locationPrecision: 'institution',
    jurisdictionLabel: 'Edwards Air Force Base, California',
    stored: { lat: 34.8899, lng: -117.833 },
    geocode: {
      lat: 34.91301,
      lng: -117.94849,
      stateName: 'California',
      method: 'geocode_other',
    },
  });
  assert.equal(decision.action, 'review');
});

test('decideLocationCorrection reviews Motown-style boulevard→street Census mismatch', () => {
  const decision = decideLocationCorrection({
    entityId: 'ent_motown_museum_001',
    locationLabel: '2648 West Grand Boulevard, Detroit',
    locationPrecision: 'institution',
    jurisdictionLabel: 'Detroit, Michigan',
    stored: { lat: 42.3642, lng: -83.0883 },
    geocode: {
      lat: 42.394489,
      lng: -83.123624,
      matchedAddress: '2648 W GRAND ST, DETROIT, MI, 48238',
      stateName: 'Michigan',
      method: 'geocode_census',
    },
  });
  assert.equal(decision.action, 'review');
  assert.match(decision.reason, /different street/i);
});

test('decideLocationCorrection reviews street drift beyond 2km safety cap', () => {
  const decision = decideLocationCorrection({
    entityId: 'ent_bridge',
    locationLabel: 'Edmund Pettus Bridge, U.S. Route 80 at Broad Street, Selma',
    locationPrecision: 'institution',
    jurisdictionLabel: 'Selma, Alabama',
    stored: { lat: 32.4053, lng: -87.0186 },
    geocode: {
      lat: 32.43135,
      lng: -87.02439,
      matchedAddress: 'US HWY 80 & BROAD ST, SELMA, AL, 36701',
      stateName: 'Alabama',
      method: 'geocode_census',
    },
  });
  assert.equal(decision.action, 'review');
  assert.match(decision.reason, /2km safety cap/i);
});

test('buildLocationGeocodeQuery extracts street segment for Census-friendly queries', () => {
  assert.equal(
    buildLocationGeocodeQuery(
      'A.G. Gaston Motel, 1510 5th Avenue North, Birmingham',
      'Birmingham, Alabama',
    ),
    '1510 5th Avenue North, Birmingham',
  );
  assert.equal(
    buildLocationGeocodeQuery('Howard University', 'Washington, District of Columbia'),
    'Howard University, Washington, District of Columbia',
  );
});
