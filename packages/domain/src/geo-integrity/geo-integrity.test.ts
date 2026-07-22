/**
 * Tests for geo-integrity containment, audit, and publish gate (fixture polygons only).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  auditEntityStateContainment,
  assertGeoIntegrityPublishGate,
  buildStateBoundaryIndex,
  evaluateGeoIntegrityPublishGate,
  evaluateStateContainment,
  pointContainedInDeclaredState,
  pointInPolygonRings,
} from './index.js';
import {
  FIXTURE_POINT_BOSTON_MA,
  FIXTURE_POINT_HARLEM_NY,
  FIXTURE_STATE_BOUNDARIES,
} from './fixtures.js';

const boundaries = buildStateBoundaryIndex(FIXTURE_STATE_BOUNDARIES);

test('MA point tagged MA passes containment', () => {
  assert.equal(
    pointContainedInDeclaredState(FIXTURE_POINT_BOSTON_MA, 'MA', boundaries),
    true,
  );
  const result = evaluateStateContainment(FIXTURE_POINT_BOSTON_MA, 'ma', boundaries);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.stateCode, 'MA');
});

test('Harlem-ish NY point tagged NJ fails containment', () => {
  assert.equal(
    pointContainedInDeclaredState(FIXTURE_POINT_HARLEM_NY, 'NJ', boundaries),
    false,
  );
  const result = evaluateStateContainment(FIXTURE_POINT_HARLEM_NY, 'NJ', boundaries);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'point_not_in_declared_state');
    assert.equal(result.inferredStateCode, 'NY');
  }
});

test('Harlem-ish NY point tagged NY passes containment', () => {
  assert.equal(
    pointContainedInDeclaredState(FIXTURE_POINT_HARLEM_NY, 'NY', boundaries),
    true,
  );
});

test('unknown declared state code fails closed', () => {
  const result = evaluateStateContainment(FIXTURE_POINT_BOSTON_MA, 'XX', boundaries);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'missing_boundary');
});

test('empty declared state code fails closed as unknown', () => {
  const result = evaluateStateContainment(FIXTURE_POINT_BOSTON_MA, '  ', boundaries);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'unknown_state_code');
});

test('pointInPolygonRings rejects coordinates outside simplified MA', () => {
  assert.equal(pointInPolygonRings({ lat: 39.0, lng: -75.0 }, FIXTURE_STATE_BOUNDARIES[0]!.rings), false);
});

test('auditEntityStateContainment returns mismatches without mutating input', () => {
  const rows = [
    {
      id: 'ent-ma-ok',
      stateCode: 'MA',
      lat: FIXTURE_POINT_BOSTON_MA.lat,
      lng: FIXTURE_POINT_BOSTON_MA.lng,
    },
    {
      id: 'ent-harlem-wrong-state',
      stateCode: 'NJ',
      lat: FIXTURE_POINT_HARLEM_NY.lat,
      lng: FIXTURE_POINT_HARLEM_NY.lng,
    },
  ];
  const snapshot = structuredClone(rows);
  const audit = auditEntityStateContainment(rows, boundaries);
  assert.deepEqual(rows, snapshot, 'audit must not rewrite input rows');
  assert.equal(audit.ok, false);
  if (!audit.ok) {
    assert.equal(audit.checked, 2);
    assert.equal(audit.mismatches.length, 1);
    assert.equal(audit.mismatches[0]!.id, 'ent-harlem-wrong-state');
    assert.equal(audit.mismatches[0]!.inferredStateCode, 'NY');
  }
});

test('evaluateGeoIntegrityPublishGate aggregates every failing location', () => {
  const rows = [
    {
      id: 'good',
      stateCode: 'MA',
      lat: FIXTURE_POINT_BOSTON_MA.lat,
      lng: FIXTURE_POINT_BOSTON_MA.lng,
    },
    {
      id: 'bad',
      stateCode: 'NJ',
      lat: FIXTURE_POINT_HARLEM_NY.lat,
      lng: FIXTURE_POINT_HARLEM_NY.lng,
    },
  ];
  const gate = evaluateGeoIntegrityPublishGate(rows, boundaries);
  assert.equal(gate.ok, false);
  if (!gate.ok) {
    assert.equal(gate.failures.length, 1);
    assert.equal(gate.failures[0]!.id, 'bad');
  }
});

test('assertGeoIntegrityPublishGate throws on mismatch', () => {
  assert.throws(() =>
    assertGeoIntegrityPublishGate(
      [
        {
          id: 'bad',
          stateCode: 'NJ',
          lat: FIXTURE_POINT_HARLEM_NY.lat,
          lng: FIXTURE_POINT_HARLEM_NY.lng,
        },
      ],
      boundaries,
    ),
  );
});

test('assertGeoIntegrityPublishGate passes when all rows match', () => {
  assert.doesNotThrow(() =>
    assertGeoIntegrityPublishGate(
      [
        {
          id: 'good-ma',
          stateCode: 'MA',
          lat: FIXTURE_POINT_BOSTON_MA.lat,
          lng: FIXTURE_POINT_BOSTON_MA.lng,
        },
        {
          id: 'good-ny',
          stateCode: 'NY',
          lat: FIXTURE_POINT_HARLEM_NY.lat,
          lng: FIXTURE_POINT_HARLEM_NY.lng,
        },
      ],
      boundaries,
    ),
  );
});
