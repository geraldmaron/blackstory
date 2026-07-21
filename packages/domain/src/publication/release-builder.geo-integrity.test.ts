/**
 * Opt-in geo-integrity wiring for the release builder (fixture polygons only).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildStateBoundaryIndex,
  FIXTURE_POINT_BOSTON_MA,
  FIXTURE_POINT_HARLEM_NY,
  FIXTURE_STATE_BOUNDARIES,
} from '../geo-integrity/index.js';
import {
  buildReleaseEntityArtifacts,
  evaluateReleaseGeoIntegrityGate,
  resolveReleaseEntityStateCode,
  type ReleaseSourceEntity,
} from './release-builder.js';

const CONTEXT = { releaseId: 'release-2026-07-18', generatedAt: '2026-07-18T00:00:00.000Z' };
const boundaries = buildStateBoundaryIndex(FIXTURE_STATE_BOUNDARIES);

function geoEntry(
  overrides: Partial<ReleaseSourceEntity> = {},
): ReleaseSourceEntity {
  return {
    id: 'ent_geo_001',
    kind: 'place',
    displayName: 'Geo Fixture Site',
    summary: 'A'.repeat(130),
    jurisdictionLabel: 'Example, Massachusetts',
    locationPrecision: 'neighborhood',
    locationLabel: 'Example neighborhood',
    lat: FIXTURE_POINT_BOSTON_MA.lat,
    lng: FIXTURE_POINT_BOSTON_MA.lng,
    topicIds: ['church'],
    claims: [
      {
        predicate: 'founded_year',
        object: '1900',
        confidenceLevel: 'high',
        citationSource: 'Example Source',
        citationLabel: 'Example Citation',
      },
    ],
    ...overrides,
  };
}

test('resolveReleaseEntityStateCode prefers explicit jurisdictionStateCode', () => {
  assert.equal(
    resolveReleaseEntityStateCode({
      jurisdictionLabel: 'Harlem, New York',
      jurisdictionStateCode: 'NJ',
    }),
    'NJ',
  );
});

test('resolveReleaseEntityStateCode parses a trailing two-letter postal code', () => {
  assert.equal(
    resolveReleaseEntityStateCode({ jurisdictionLabel: 'Harlem, NY' }),
    'NY',
  );
});

test('resolveReleaseEntityStateCode parses a trailing full state name', () => {
  assert.equal(
    resolveReleaseEntityStateCode({ jurisdictionLabel: 'Boston, Massachusetts' }),
    'MA',
  );
});

test('evaluateReleaseGeoIntegrityGate is a no-op when boundaries are omitted', () => {
  const entry = geoEntry({ jurisdictionStateCode: 'NJ' });
  const gate = evaluateReleaseGeoIntegrityGate(
    entry,
    CONTEXT,
    FIXTURE_POINT_HARLEM_NY.lat,
    FIXTURE_POINT_HARLEM_NY.lng,
  );
  assert.equal(gate.ok, true);
});

test('buildReleaseEntityArtifacts passes without boundaries even when state would mismatch', () => {
  const entry = geoEntry({
    id: 'ent_harlem_wrong_state',
    displayName: 'Harlem fixture',
    jurisdictionStateCode: 'NJ',
    lat: FIXTURE_POINT_HARLEM_NY.lat,
    lng: FIXTURE_POINT_HARLEM_NY.lng,
    jurisdictionLabel: 'Harlem, New Jersey',
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
});

test('buildReleaseEntityArtifacts fails closed when Harlem-ish NY is tagged NJ with boundaries', () => {
  const entry = geoEntry({
    id: 'ent_harlem_wrong_state',
    displayName: 'Harlem fixture',
    jurisdictionStateCode: 'NJ',
    lat: FIXTURE_POINT_HARLEM_NY.lat,
    lng: FIXTURE_POINT_HARLEM_NY.lng,
    jurisdictionLabel: 'Harlem, New Jersey',
  });
  const result = buildReleaseEntityArtifacts(entry, {
    ...CONTEXT,
    geoIntegrity: { stateBoundaries: boundaries },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'geo_integrity_gate');
  assert.match(result.message, /NJ/);
  assert.match(result.message, /NY/);
});

test('buildReleaseEntityArtifacts passes when Boston-ish MA is tagged MA with boundaries', () => {
  const entry = geoEntry({
    jurisdictionStateCode: 'MA',
    jurisdictionLabel: 'Boston, Massachusetts',
    lat: FIXTURE_POINT_BOSTON_MA.lat,
    lng: FIXTURE_POINT_BOSTON_MA.lng,
  });
  const result = buildReleaseEntityArtifacts(entry, {
    ...CONTEXT,
    stateBoundaries: boundaries,
  });
  assert.equal(result.ok, true);
});

test('buildReleaseEntityArtifacts geo gate uses locationOverride coordinates', () => {
  const entry = geoEntry({
    jurisdictionStateCode: 'NJ',
    lat: FIXTURE_POINT_BOSTON_MA.lat,
    lng: FIXTURE_POINT_BOSTON_MA.lng,
  });
  const result = buildReleaseEntityArtifacts(entry, {
    ...CONTEXT,
    geoIntegrity: { stateBoundaries: boundaries },
    locationOverride: {
      lat: FIXTURE_POINT_HARLEM_NY.lat,
      lng: FIXTURE_POINT_HARLEM_NY.lng,
    },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'geo_integrity_gate');
});
