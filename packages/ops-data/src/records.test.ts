/** Entity, geography, provenance and claim validation. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertEvidenceMayPublish,
  assertEvidenceResolvesToSourceItem,
  assertNarrativeMayCiteClaim,
  canSourceAdapterCreateCandidates,
  narrativeMayCiteClaim,
} from '@repo/domain';
import {
  canonicalClaimSchema,
  canonicalEntitySchema,
  claimEvidenceLinkSchema,
  entityLocationSchema,
  entityMergeSchema,
  entityRelationshipSchema,
  evidenceRecordSchema,
  evidenceSourceSchema,
  parseWithSchema,
  publicEntityProjectionSchema,
  sourceCaptureSchema,
  sourceItemSchema,
} from './records/index.js';
import {
  seedCanonicalClaim,
  seedClaimEvidenceSyndicated,
  seedClaimEvidenceSupporting,
  seedDisabledEvidenceSource,
  seedEntityMerge,
  seedEvidenceRecord,
  seedEvidenceSource,
  seedHighImpactClaim,
  seedPersonEntity,
  seedPersonSchoolRelationship,
  seedPlaceCurrentLocation,
  seedPlaceHistoricalLocation,
  seedPublicEntity,
  seedSchoolEntity,
  seedSourceCapture,
  seedSourceItem,
} from '../fixtures/records.js';

test('public entity projection seed parses with geohash', () => {
  const parsed = parseWithSchema(publicEntityProjectionSchema, seedPublicEntity);
  assert.equal(parsed.id, 'ent_15th_st_church_001');
  assert.ok(parsed.location?.geohash);
  assert.equal(parsed.location?.precision, 'neighborhood');
  assert.equal(parsed.location?.matchMethod, 'manual_research');
});

test('canonical school and person seeds parse', () => {
  const school = parseWithSchema(canonicalEntitySchema, seedSchoolEntity);
  assert.equal(school.kind, 'school');
  assert.equal(school.school?.campuses.length, 2);
  const person = parseWithSchema(canonicalEntitySchema, seedPersonEntity);
  assert.equal(person.livingStatus, 'unknown');
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

test(' provenance seeds parse and evidence resolves to source item', () => {
  const source = parseWithSchema(evidenceSourceSchema, seedEvidenceSource);
  assert.equal(source.policy.snapshotMode, 'selective');
  assert.equal(source.adapterEnabled, true);
  const item = parseWithSchema(sourceItemSchema, seedSourceItem);
  assert.equal(item.stableIdentifier, 'NAID-SEED-001');
  const capture = parseWithSchema(sourceCaptureSchema, seedSourceCapture);
  assert.equal(capture.contentHash.algorithm, 'sha256');
  assert.equal(capture.snapshotMode, 'selective');
  const evidence = parseWithSchema(evidenceRecordSchema, seedEvidenceRecord);
  assertEvidenceResolvesToSourceItem(evidence);
  assert.equal(evidence.sourceItemId, item.id);
  assert.doesNotThrow(() => assertEvidenceMayPublish(evidence, 'short_excerpt'));
});

test('disabled source adapter seed cannot create candidates', () => {
  const disabled = parseWithSchema(evidenceSourceSchema, seedDisabledEvidenceSource);
  assert.equal(disabled.adapterEnabled, false);
  assert.equal(canSourceAdapterCreateCandidates(disabled), false);
});

test('canonical claim seed parses with confidence components and policyVersion', () => {
  const claim = parseWithSchema(canonicalClaimSchema, seedCanonicalClaim);
  assert.equal(claim.id, 'claim_seed_001');
  assert.equal(claim.publicationStatus, 'published');
  assert.ok(claim.confidence);
  assert.equal(claim.confidence.policyVersion, '1.1.0');
  assert.equal(claim.confidence.independentLineageCount, 1);
  assert.ok(claim.preservedValues.some((v) => v.kind === 'contradicting' && v.value === '1840'));
  assert.doesNotThrow(() => assertNarrativeMayCiteClaim(claim));

  const support = parseWithSchema(claimEvidenceLinkSchema, seedClaimEvidenceSupporting);
  const syndicated = parseWithSchema(claimEvidenceLinkSchema, seedClaimEvidenceSyndicated);
  assert.equal(support.lineageRootId, syndicated.lineageRootId);

  const highImpact = parseWithSchema(canonicalClaimSchema, seedHighImpactClaim);
  assert.equal(highImpact.claimClass, 'high_impact');
  assert.equal(highImpact.publicationStatus, 'unpublished');
  assert.equal(narrativeMayCiteClaim(highImpact), false);
});
