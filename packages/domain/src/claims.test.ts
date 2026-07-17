/**
 * Gold-fixture tests for claims, contradictions, and deterministic confidence.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadProductConstitution } from '@black-book/schemas';
import {
  assertAtomicClaimValid,
  assertClaimEvidenceLinkValid,
  assertClaimMayPublish,
  assertContradictionsPreserved,
  assertHighImpactThresholdHigher,
  assertNarrativeMayCiteClaim,
  calculateClaimConfidence,
  claimClassThreshold,
  lineageIndependenceFromCount,
  measureConnectionStrength,
  measureRelevance,
  narrativeMayCiteClaim,
  preserveContradictoryValues,
  uniqueLineageAggregates,
  type AtomicClaim,
  type ClaimEvidenceLink,
} from './index.ts';

const FIXED_NOW = '2026-07-16T23:00:00.000Z';
const POLICY = loadProductConstitution();

function link(overrides: Partial<ClaimEvidenceLink> & Pick<ClaimEvidenceLink, 'id' | 'role' | 'lineageRootId' | 'evidenceId'>): ClaimEvidenceLink {
  const base: ClaimEvidenceLink = {
    id: overrides.id,
    claimId: 'claim_gold_001',
    claimVersionId: 'cver_gold_001',
    evidenceId: overrides.evidenceId,
    role: overrides.role,
    lineageRootId: overrides.lineageRootId,
    credible: true,
    sourceClassification: 'primary_archival',
    directness: 0.9,
    temporalProximity: 0.85,
    geographicPrecision: 0.8,
    entityMatchQuality: 0.9,
    extractionQuality: 0.88,
    createdAt: FIXED_NOW,
    ...overrides,
  };
  assertClaimEvidenceLinkValid(base);
  return base;
}

test('syndicated copies sharing lineageRootId count as one lineage', () => {
  const links = [
    link({
      id: 'cel_a',
      evidenceId: 'ev_root',
      role: 'supporting',
      lineageRootId: 'ev_root',
      sourceClassification: 'primary_archival',
    }),
    link({
      id: 'cel_b',
      evidenceId: 'ev_wire_1',
      role: 'supporting',
      lineageRootId: 'ev_root',
      sourceClassification: 'news_reportage',
      directness: 0.4,
    }),
    link({
      id: 'cel_c',
      evidenceId: 'ev_wire_2',
      role: 'supporting',
      lineageRootId: 'ev_root',
      sourceClassification: 'news_reportage',
      directness: 0.35,
    }),
    link({
      id: 'cel_d',
      evidenceId: 'ev_wire_3',
      role: 'supporting',
      lineageRootId: 'ev_root',
      sourceClassification: 'news_reportage',
      directness: 0.3,
    }),
    link({
      id: 'cel_e',
      evidenceId: 'ev_wire_4',
      role: 'supporting',
      lineageRootId: 'ev_root',
      sourceClassification: 'news_reportage',
      directness: 0.25,
    }),
  ];

  assert.equal(POLICY.publicationRestrictions.blockSyndicatedCopiesAsIndependent, true);
  const aggregates = uniqueLineageAggregates(links, 'supporting', {
    blockSyndicatedCopiesAsIndependent: true,
  });
  assert.equal(aggregates.length, 1);
  assert.equal(aggregates[0]?.evidenceId, 'ev_root');

  const score = calculateClaimConfidence({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    policy: POLICY,
  });
  assert.equal(score.independentLineageCount, 1);
  assert.equal(score.supportingEvidenceCount, 5);
  assert.equal(score.components.lineageIndependence, lineageIndependenceFromCount(1));
  assert.equal(score.policyVersion, POLICY.policyVersion);
  assert.ok(score.components.sourceAuthority > 0.9);
});

test('confidence retains component values and policy version', () => {
  const links = [
    link({
      id: 'cel_1',
      evidenceId: 'ev_1',
      role: 'supporting',
      lineageRootId: 'ev_1',
      sourceClassification: 'government_record',
    }),
    link({
      id: 'cel_2',
      evidenceId: 'ev_2',
      role: 'supporting',
      lineageRootId: 'ev_2',
      sourceClassification: 'peer_reviewed',
      directness: 0.8,
    }),
  ];
  const result = calculateClaimConfidence({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    policy: POLICY,
  });

  assert.equal(result.policyVersion, '1.0.0');
  assert.equal(typeof result.components.sourceAuthority, 'number');
  assert.equal(typeof result.components.directness, 'number');
  assert.equal(typeof result.components.lineageIndependence, 'number');
  assert.equal(typeof result.components.temporalProximity, 'number');
  assert.equal(typeof result.components.geographicPrecision, 'number');
  assert.equal(typeof result.components.entityMatchQuality, 'number');
  assert.equal(typeof result.components.extractionQuality, 'number');
  assert.equal(typeof result.components.contradictionPenalty, 'number');
  assert.equal(result.independentLineageCount, 2);
  assert.deepEqual([...result.contributingEvidenceIds].sort(), ['ev_1', 'ev_2']);
});

test('high-impact claims use a higher publication threshold', () => {
  assertHighImpactThresholdHigher(POLICY);
  assert.equal(claimClassThreshold('standard', POLICY), 0.75);
  assert.equal(claimClassThreshold('high_impact', POLICY), 0.9);

  const modestLinks = [
    link({
      id: 'cel_hi',
      evidenceId: 'ev_hi',
      role: 'supporting',
      lineageRootId: 'ev_hi',
      sourceClassification: 'reputable_secondary',
      directness: 0.7,
      temporalProximity: 0.7,
      geographicPrecision: 0.7,
      entityMatchQuality: 0.7,
      extractionQuality: 0.7,
    }),
  ];
  const result = calculateClaimConfidence({
    claimClass: 'high_impact',
    evidenceLinks: modestLinks,
    calculatedAt: FIXED_NOW,
    policy: POLICY,
  });
  assert.equal(result.threshold, 0.9);
  assert.equal(result.passesPublishThreshold, result.score >= 0.9);

  const standard = calculateClaimConfidence({
    claimClass: 'standard',
    evidenceLinks: modestLinks,
    calculatedAt: FIXED_NOW,
    policy: POLICY,
  });
  assert.equal(standard.threshold, 0.75);
  assert.ok(standard.score === result.score);
  assert.ok(standard.passesPublishThreshold || !result.passesPublishThreshold || standard.score >= 0.9);
});

test('contradictory credible values are preserved', () => {
  const links = [
    link({
      id: 'cel_sup',
      evidenceId: 'ev_sup',
      role: 'supporting',
      lineageRootId: 'ev_sup',
      assertedValue: 'Founded in 1867',
    }),
    link({
      id: 'cel_con',
      evidenceId: 'ev_con',
      role: 'contradicting',
      lineageRootId: 'ev_con',
      sourceClassification: 'government_record',
      assertedValue: 'Founded in 1868',
      credible: true,
    }),
  ];
  const set = preserveContradictoryValues({
    claimId: 'claim_gold_001',
    primaryValue: 'Founded in 1867',
    evidenceLinks: links,
  });
  assert.equal(set.hasCredibleContradiction, true);
  assert.ok(set.values.some((v) => v.kind === 'contradicting' && v.value === 'Founded in 1868'));
  assertContradictionsPreserved(set);

  const scored = calculateClaimConfidence({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    policy: POLICY,
  });
  assert.ok(scored.components.contradictionPenalty > 0);
});

test('narrative cannot cite an unpublished claim', () => {
  const unpublished: Pick<AtomicClaim, 'id' | 'workflowStatus' | 'publicationStatus'> = {
    id: 'claim_draft',
    workflowStatus: 'accepted',
    publicationStatus: 'unpublished',
  };
  assert.equal(narrativeMayCiteClaim(unpublished), false);
  assert.throws(() => assertNarrativeMayCiteClaim(unpublished), /cannot cite unpublished claim/);

  const proposed: Pick<AtomicClaim, 'id' | 'workflowStatus' | 'publicationStatus'> = {
    id: 'claim_proposed',
    workflowStatus: 'proposed',
    publicationStatus: 'unpublished',
  };
  assert.throws(() => assertNarrativeMayCiteClaim(proposed), /cannot cite unpublished claim/);

  const published: Pick<AtomicClaim, 'id' | 'workflowStatus' | 'publicationStatus'> = {
    id: 'claim_pub',
    workflowStatus: 'accepted',
    publicationStatus: 'published',
  };
  assert.equal(narrativeMayCiteClaim(published), true);
  assert.doesNotThrow(() => assertNarrativeMayCiteClaim(published));
});

test('atomic claim versions and publication gate', () => {
  const claim: AtomicClaim = {
    id: 'claim_gold_001',
    entityId: 'ent_seed_place_001',
    predicate: 'founded_year',
    currentVersionId: 'cver_gold_001',
    versions: [
      {
        id: 'cver_gold_001',
        claimId: 'claim_gold_001',
        versionNumber: 1,
        entityId: 'ent_seed_place_001',
        predicate: 'founded_year',
        object: '1867',
        proceduralStatus: 'ruled',
        claimClass: 'standard',
        workflowStatus: 'accepted',
        publicationStatus: 'unpublished',
        temporal: { label: 'founding', validFrom: '1867-01-01' },
        geographic: { locationId: 'loc_place_historical', precision: 'institution' },
        createdAt: FIXED_NOW,
      },
    ],
    claimClass: 'standard',
    workflowStatus: 'accepted',
    publicationStatus: 'unpublished',
    proceduralStatus: 'ruled',
    temporal: { label: 'founding', validFrom: '1867-01-01' },
    geographic: { locationId: 'loc_place_historical', precision: 'institution' },
    preservedValues: [
      {
        value: '1867',
        evidenceLinkIds: ['cel_sup'],
        credible: true,
        kind: 'primary',
      },
    ],
    researchCoverage: { level: 'partial', score: 0.55 },
    relevance: measureRelevance(0.82, 'include'),
    connectionStrength: measureConnectionStrength(0.78, 'Campus founding tied to place history'),
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };

  assert.doesNotThrow(() => assertAtomicClaimValid(claim));
  assert.equal(claim.relevance?.policyVersion, POLICY.policyVersion);

  const strongLinks = [
    link({
      id: 'cel_s1',
      evidenceId: 'ev_s1',
      role: 'supporting',
      lineageRootId: 'ev_s1',
      sourceClassification: 'primary_archival',
    }),
    link({
      id: 'cel_s2',
      evidenceId: 'ev_s2',
      role: 'supporting',
      lineageRootId: 'ev_s2',
      sourceClassification: 'government_record',
    }),
    link({
      id: 'cel_s3',
      evidenceId: 'ev_s3',
      role: 'supporting',
      lineageRootId: 'ev_s3',
      sourceClassification: 'peer_reviewed',
    }),
  ];
  const confidence = calculateClaimConfidence({
    claimClass: 'standard',
    evidenceLinks: strongLinks,
    calculatedAt: FIXED_NOW,
    policy: POLICY,
  });
  assert.ok(confidence.passesPublishThreshold);

  assert.doesNotThrow(() =>
    assertClaimMayPublish({
      claim,
      confidence,
      hasQualifyingEvidence: true,
      narrativeSnippet: 'The institution was founded in 1867 per archival records.',
      policy: POLICY,
    }),
  );

  assert.throws(
    () =>
      assertClaimMayPublish({
        claim: { ...claim, claimClass: 'high_impact' },
        confidence: { ...confidence, score: 0.8 },
        hasQualifyingEvidence: true,
        policy: POLICY,
      }),
    /below high_impact publish threshold/,
  );
});

test('confidence calculation is deterministic for identical inputs', () => {
  const links = [
    link({
      id: 'cel_d1',
      evidenceId: 'ev_d1',
      role: 'supporting',
      lineageRootId: 'ev_d1',
    }),
    link({
      id: 'cel_d2',
      evidenceId: 'ev_d2',
      role: 'supporting',
      lineageRootId: 'ev_d2',
      sourceClassification: 'news_reportage',
    }),
  ];
  const a = calculateClaimConfidence({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    policy: POLICY,
  });
  const b = calculateClaimConfidence({
    claimClass: 'standard',
    evidenceLinks: [...links].reverse(),
    calculatedAt: FIXED_NOW,
    policy: POLICY,
  });
  assert.equal(a.score, b.score);
  assert.deepEqual(a.components, b.components);
  assert.equal(a.policyVersion, b.policyVersion);
});
