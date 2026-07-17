/**
 * Domain model tests for entities, geography, merge lineage, and living-status (BB-014).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asEntityId,
  assertMergeReversible,
  assertPublicPrecisionAllowed,
  assertRelationshipHasEvidence,
  assertZipNotHistoricalBoundary,
  buildGeoPointFields,
  encodeGeohash,
  geohashPrefixes,
  hasHistoricalAndCurrent,
  isPublicPrecisionAllowed,
  livingStatuses,
  locationsMayCoexist,
  reverseMerge,
  treatAsLiving,
  type EntityLocation,
  type EntityMergeRecord,
  type EntityRelationship,
} from './index.ts';

test('unknown living status is treated as living', () => {
  assert.equal(treatAsLiving('unknown'), true);
});

test('deceased is not treated as living', () => {
  assert.equal(treatAsLiving('deceased'), false);
});

test('living status vocabulary comes from constitution', () => {
  assert.deepEqual([...livingStatuses()], ['living', 'deceased', 'unknown']);
});

test('EntityId rejects empty strings', () => {
  assert.throws(() => asEntityId(''), /non-empty/);
});

test('geohash encode is stable for known DC point', () => {
  const hash = encodeGeohash(38.9072, -77.0369, 5);
  assert.equal(hash, 'dqcjq');
  assert.deepEqual(geohashPrefixes(hash), ['d', 'dq', 'dqc', 'dqcj', 'dqcjq']);
});

test('buildGeoPointFields includes prefixes', () => {
  const fields = buildGeoPointFields(38.9072, -77.0369, 5);
  assert.equal(fields.geohash, 'dqcjq');
  assert.ok(fields.geohashPrefixes.includes('dqcjq'));
});

test('historical and current locations can coexist', () => {
  assert.equal(locationsMayCoexist('historical', 'current'), true);
  const locations: EntityLocation[] = [
    {
      id: 'loc_hist',
      entityId: 'ent_school',
      role: 'historical',
      geometry: { type: 'Point', coordinates: [-77.04, 38.9] },
      precision: 'campus',
      validFrom: '1920',
      validTo: '1954',
    },
    {
      id: 'loc_cur',
      entityId: 'ent_school',
      role: 'current',
      geometry: { type: 'Point', coordinates: [-77.03, 38.91] },
      precision: 'campus',
      validFrom: '1954',
      validTo: null,
      modernZip: { zip: '20001', role: 'modern_input' },
    },
  ];
  assert.equal(hasHistoricalAndCurrent(locations), true);
});

test('ZIP is modern input only, not historical boundary', () => {
  assert.doesNotThrow(() => assertZipNotHistoricalBoundary('modern_input'));
  assert.doesNotThrow(() => assertZipNotHistoricalBoundary('modern_lookup'));
  assert.throws(() => assertZipNotHistoricalBoundary('historical_boundary'), /modern/);
});

test('public precision rejects street_address; allows campus', () => {
  assert.equal(isPublicPrecisionAllowed('street_address'), false);
  assert.equal(isPublicPrecisionAllowed('campus'), true);
  assert.doesNotThrow(() => assertPublicPrecisionAllowed('city'));
  assert.throws(() => assertPublicPrecisionAllowed('exact_coordinates'));
});

test('living residential precision is rejected at model helpers', () => {
  assert.equal(isPublicPrecisionAllowed('residence', { livingStatus: 'unknown' }), false);
  assert.equal(isPublicPrecisionAllowed('city', { livingStatus: 'unknown' }), true);
});

test('relationships require evidence and may carry time context', () => {
  const rel: EntityRelationship = {
    id: 'rel_1',
    fromEntityId: 'ent_person',
    toEntityId: 'ent_school',
    type: 'attended',
    evidenceIds: ['ev_1'],
    temporal: { validFrom: '1940', validTo: '1944' },
    geographic: { locationId: 'loc_hist' },
    createdAt: '2026-07-16T18:00:00.000Z',
    updatedAt: '2026-07-16T18:00:00.000Z',
  };
  assert.doesNotThrow(() => assertRelationshipHasEvidence(rel));
  assert.throws(() => assertRelationshipHasEvidence({ evidenceIds: [] }), /evidence/);
});

test('entity merges are reversible and audited', () => {
  const merge: EntityMergeRecord = {
    id: 'merge_1',
    survivorId: 'ent_a',
    absorbedIds: ['ent_b'],
    status: 'active',
    reason: 'duplicate names',
    evidenceIds: ['ev_dup'],
    createdAt: '2026-07-16T18:00:00.000Z',
    createdBy: 'researcher_1',
    auditEventIds: ['audit_merge_1'],
  };
  assert.doesNotThrow(() => assertMergeReversible(merge));
  const reversed = reverseMerge(merge, {
    reversedBy: 'admin_1',
    reverseReason: 'false positive duplicate',
    reversedAt: '2026-07-16T19:00:00.000Z',
    auditEventId: 'audit_reverse_1',
  });
  assert.equal(reversed.status, 'reversed');
  assert.deepEqual(reversed.auditEventIds, ['audit_merge_1', 'audit_reverse_1']);
  assert.throws(() => assertMergeReversible(reversed), /not active/);
});
