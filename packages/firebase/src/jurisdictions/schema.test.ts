/**
 * Tests for the BB-091 `jurisdictions` Firestore doc schema/converter.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  countryJurisdictionId,
  countyJurisdictionId,
  jurisdictionConverter,
  jurisdictionSchema,
  stateJurisdictionId,
} from './schema.js';

const VALID_STATE_DOC = {
  id: 'us-06',
  kind: 'state' as const,
  name: 'California',
  parentId: 'us',
  fipsCode: '06',
  postalCode: 'CA',
  bbox: [-124.5, 32.5, -114.1, 42.0] as const,
  bboxSource: 'us-geography-module' as const,
  sourceDataset: 'us-geography-module',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

test('deterministic id helpers produce stable, hierarchical ids', () => {
  assert.equal(countryJurisdictionId(), 'us');
  assert.equal(stateJurisdictionId('06'), 'us-06');
  assert.equal(countyJurisdictionId('06', '037'), 'us-06-037');
  // Calling twice yields the exact same id (idempotency at the id layer).
  assert.equal(stateJurisdictionId('06'), stateJurisdictionId('06'));
});

test('jurisdictionSchema accepts a well-formed state doc', () => {
  assert.doesNotThrow(() => jurisdictionSchema.parse(VALID_STATE_DOC));
});

test('jurisdictionSchema accepts a well-formed county doc', () => {
  const countyDoc = {
    id: 'us-06-037',
    kind: 'county' as const,
    name: 'Los Angeles County',
    parentId: 'us-06',
    fipsCode: '06037',
    stateFips: '06',
    bbox: [-119.0, 33.5, -117.5, 34.9] as const,
    bboxSource: 'census-gazetteer-area-approximated' as const,
    centroid: { lat: 34.317, lng: -118.226 },
    sourceDataset: 'census-gazetteer-counties',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  assert.doesNotThrow(() => jurisdictionSchema.parse(countyDoc));
});

test('jurisdictionSchema rejects an unknown kind', () => {
  assert.throws(() => jurisdictionSchema.parse({ ...VALID_STATE_DOC, kind: 'planet' }));
});

test('jurisdictionSchema rejects a malformed FIPS code', () => {
  assert.throws(() => jurisdictionSchema.parse({ ...VALID_STATE_DOC, fipsCode: 'not-a-fips' }));
});

test('jurisdictionSchema requires sourceDataset (provenance is not optional)', () => {
  const { sourceDataset: _drop, ...withoutSource } = VALID_STATE_DOC;
  assert.throws(() => jurisdictionSchema.parse(withoutSource));
});

test('jurisdictionConverter round-trips through toFirestore/fromFirestore', () => {
  const written = jurisdictionConverter.toFirestore(VALID_STATE_DOC);
  const read = jurisdictionConverter.fromFirestore({ data: () => written });
  assert.deepEqual(read, VALID_STATE_DOC);
});

test('jurisdictionConverter fails closed on a corrupted document', () => {
  assert.throws(() =>
    jurisdictionConverter.fromFirestore({ data: () => ({ ...VALID_STATE_DOC, name: '' }) }),
  );
});
