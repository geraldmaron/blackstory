/**
 * Tests for product constitution loaders and evaluation helpers.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as constitutionApi from './index.ts';
import {
  CONSTITUTION_SCHEMA_PATH,
  evaluateClaimConfidence,
  evaluateLivingStatus,
  evaluateProceduralLanguage,
  evaluatePublicPrecision,
  evaluateRelevance,
  getPolicyVersion,
  loadAllConstitutionFixtures,
  loadProductConstitution,
  resetProductConstitutionCache,
} from './index.ts';

test('loads versioned product constitution from shared JSON', () => {
  resetProductConstitutionCache();
  const policy = loadProductConstitution();
  assert.equal(policy.policyVersion, '1.0.0');
  assert.equal(getPolicyVersion(), '1.0.0');
  assert.ok(policy.relevanceThresholds.includeMinimum > 0);
  assert.ok(
    policy.claimConfidenceThresholds.highImpactPublish >
      policy.claimConfidenceThresholds.standardPublish,
  );
});

test('JSON Schema artifact exists beside policy values', () => {
  const schema = JSON.parse(readFileSync(CONSTITUTION_SCHEMA_PATH, 'utf8')) as {
    title?: string;
  };
  assert.equal(schema.title, 'Black Book product constitution');
});

test('every evaluation records policyVersion', () => {
  const living = evaluateLivingStatus('unknown');
  const precision = evaluatePublicPrecision('city');
  const procedural = evaluateProceduralLanguage('Court ruled on the ordinance.', 'ruled');
  const relevance = evaluateRelevance(0.8, 'include');
  const confidence = evaluateClaimConfidence(0.8, 'standard');
  for (const result of [living, precision, procedural, relevance, confidence]) {
    assert.equal(result.policyVersion, '1.0.0');
  }
});

test('living and unknown status are treated as living', () => {
  assert.equal(evaluateLivingStatus('living').treatAsLiving, true);
  assert.equal(evaluateLivingStatus('unknown').treatAsLiving, true);
  assert.equal(evaluateLivingStatus('deceased').treatAsLiving, false);
});

test('prohibited location precision is rejected', () => {
  const result = evaluatePublicPrecision('street_address');
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'prohibited_location_precision');
});

test('living-person residential precision is rejected', () => {
  const result = evaluatePublicPrecision('street_address', { livingStatus: 'unknown' });
  assert.equal(result.allowed, false);
});

test('unsupported procedural language is rejected', () => {
  const result = evaluateProceduralLanguage(
    'Neighbors called him the murderer without a verdict.',
    'alleged',
  );
  assert.equal(result.supported, false);
  assert.ok(result.violations.includes('the murderer'));
});

test('unrecognized procedural status is rejected', () => {
  const result = evaluateProceduralLanguage('The account describes events.', 'totally_guilty');
  assert.equal(result.supported, false);
  assert.equal(result.proceduralStatusRecognized, false);
});

test('fixtures cover included, excluded, disputed, sparse, sensitive, living-person', () => {
  const fixtures = loadAllConstitutionFixtures();
  assert.deepEqual(Object.keys(fixtures).sort(), [
    'disputed',
    'excluded',
    'included',
    'living_person',
    'sensitive',
    'sparse',
  ]);
  assert.equal(fixtures.included.fixtureKind, 'included');
  assert.equal(fixtures.excluded.fixtureKind, 'excluded');
  assert.equal(fixtures.disputed.disputePresent, true);
  assert.equal(fixtures.sparse.maturity, 'minimum_record');
  assert.equal(fixtures.sensitive.evidencePrecision, 'street_address');
  assert.equal(fixtures.living_person.livingStatus, 'unknown');
  assert.equal(evaluateLivingStatus(fixtures.living_person.livingStatus).treatAsLiving, true);
  assert.equal(
    evaluatePublicPrecision(fixtures.living_person.publicPrecision, {
      livingStatus: fixtures.living_person.livingStatus,
    }).allowed,
    false,
  );
  assert.equal(
    evaluatePublicPrecision(fixtures.sensitive.publicPrecision, {
      livingStatus: fixtures.sensitive.livingStatus,
    }).allowed,
    true,
  );
  assert.equal(
    evaluatePublicPrecision(fixtures.sensitive.evidencePrecision ?? 'city').allowed,
    false,
  );
});

test('ugcLivingPersonRules extends the constitution without bumping policyVersion (BB-077)', () => {
  resetProductConstitutionCache();
  const policy = loadProductConstitution();
  assert.equal(policy.policyVersion, '1.0.0');
  assert.equal(policy.ugcLivingPersonRules.crossSourceProfileAggregationProhibited, true);
  assert.equal(policy.ugcLivingPersonRules.deanonymizationProhibited, true);
  assert.equal(policy.ugcLivingPersonRules.elevatedClaimClass, 'high_impact');
  assert.equal(policy.claimConfidenceThresholds.highImpactPublish, 0.9);
});

test('constitution package surface has no mutation API', () => {
  const banned = [
    'updateProductConstitution',
    'setPolicy',
    'writePolicy',
    'mutatePolicy',
    'saveProductConstitution',
    'patchConstitution',
  ];
  for (const name of banned) {
    assert.equal(Object.hasOwn(constitutionApi, name), false, `unexpected export: ${name}`);
  }
});
