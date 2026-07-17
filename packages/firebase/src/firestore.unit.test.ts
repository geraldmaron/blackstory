/**
 * Unit tests for Firestore claim helpers and converters (no emulator required).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canPublish,
  canonicalEntitySchema,
  entityLocationSchema,
  entityMergeSchema,
  entityRelationshipSchema,
  parseWithSchema,
  publicEntityProjectionSchema,
  researchMayPublish,
  resolveStaffRoles,
} from './firestore/index.js';
import {
  firestoreSeedDocuments,
  seedEntityMerge,
  seedPersonEntity,
  seedPersonSchoolRelationship,
  seedPlaceCurrentLocation,
  seedPlaceHistoricalLocation,
  seedPublicEntity,
  seedSchoolEntity,
} from '../fixtures/firestore-seed.js';

test('research claim alone cannot publish', () => {
  assert.equal(researchMayPublish({ research: true, bb_role: 'research' }), false);
  assert.equal(canPublish({ research: true }), false);
});

test('publication and admin claims can publish', () => {
  assert.equal(canPublish({ publication: true }), true);
  assert.equal(canPublish({ admin: true }), true);
  assert.ok(resolveStaffRoles({ admin: true }).includes('research'));
});

test('public entity projection seed parses with geohash', () => {
  const parsed = parseWithSchema(publicEntityProjectionSchema, seedPublicEntity);
  assert.equal(parsed.id, 'ent_seed_place_001');
  assert.ok(parsed.location?.geohash);
  assert.equal(parsed.location?.precision, 'city');
  assert.equal(parsed.location?.matchMethod, 'manual_research');
});

test('canonical school and person seeds parse', () => {
  const school = parseWithSchema(canonicalEntitySchema, seedSchoolEntity);
  assert.equal(school.kind, 'school');
  assert.equal(school.school?.campuses.length, 2);
  const person = parseWithSchema(canonicalEntitySchema, seedPersonEntity);
  assert.equal(person.livingStatus, 'unknown');
  assert.equal(person.person?.livingStatus, 'unknown');
});

test('historical and current location seeds parse and coexist', () => {
  const hist = parseWithSchema(entityLocationSchema, seedPlaceHistoricalLocation);
  const cur = parseWithSchema(entityLocationSchema, seedPlaceCurrentLocation);
  assert.equal(hist.role, 'historical');
  assert.equal(cur.role, 'current');
  assert.equal(cur.modernZip?.role, 'modern_input');
  assert.equal(hist.modernZip, undefined);
});

test('relationship and merge seeds parse with evidence and audit lineage', () => {
  const rel = parseWithSchema(entityRelationshipSchema, seedPersonSchoolRelationship);
  assert.ok(rel.evidenceIds.length >= 1);
  assert.ok(rel.temporal?.validFrom);
  const merge = parseWithSchema(entityMergeSchema, seedEntityMerge);
  assert.equal(merge.status, 'active');
  assert.ok(merge.auditEventIds.includes('audit_seed_merge_001'));
});

test('seed fixture includes BB-014 domain paths', () => {
  const paths = firestoreSeedDocuments.map((doc) => doc.path);
  assert.ok(paths.some((path) => path.includes('/locations/')));
  assert.ok(paths.some((path) => path.startsWith('entityRelationships/')));
  assert.ok(paths.some((path) => path.startsWith('entityMerges/')));
  assert.ok(paths.some((path) => path.startsWith('canonicalEntities/ent_seed_school')));
  assert.ok(paths.some((path) => path.startsWith('canonicalEntities/ent_seed_person')));
});
