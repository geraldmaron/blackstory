/**
 * Acceptance tests for Sybil source-independence signals: shared-infrastructure
 * lineage collapse, advisory timing signals, the top-tier-source publication gate, and
 * backward-compatible parity with plain confidence recalculation.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadProductConstitution } from '@black-book/schemas';
import type { ClaimEvidenceLink } from '../claims/evidence-link.js';
import { recalculateConfidence } from './engine.js';
import {
  assessAdvisorySignals,
  collapseSharedInfrastructureLineages,
  detectSharedInfrastructureClusters,
  evaluateTopTierSourceGate,
  recalculateConfidenceWithSybilSignals,
  type SourceIndependenceMetadata,
} from './sybil-signals.js';

const FIXED_NOW = '2026-07-17T04:00:00.000Z';
const POLICY = loadProductConstitution();

function evidence(
  id: string,
  lineageRootId: string,
  overrides: Partial<ClaimEvidenceLink> = {},
): ClaimEvidenceLink {
  return {
    id: `link_${id}`,
    claimId: 'claim_089',
    claimVersionId: 'claim_089_v1',
    evidenceId: id,
    role: 'supporting',
    lineageRootId,
    credible: true,
    sourceClassification: 'reputable_secondary',
    directness: 0.7875,
    temporalProximity: 0.7875,
    geographicPrecision: 0.7875,
    entityMatchQuality: 0.7875,
    extractionQuality: 0.7875,
    createdAt: FIXED_NOW,
    ...overrides,
  };
}

function meta(
  lineageRootId: string,
  evidenceId: string,
  overrides: Partial<SourceIndependenceMetadata> = {},
): SourceIndependenceMetadata {
  return { lineageRootId, evidenceId, ...overrides };
}

test('shared RDAP registrant collapses two lineage roots and can flip a claim from passing to failing', () => {
  const links = [evidence('a', 'root_a'), evidence('b', 'root_b')];

  const withoutSignals = recalculateConfidence({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    policy: POLICY,
  });
  assert.equal(withoutSignals.independentLineageCount, 2);
  assert.equal(withoutSignals.passesPublishThreshold, true);

  const withSignals = recalculateConfidenceWithSybilSignals({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    referenceDate: FIXED_NOW,
    policy: POLICY,
    sourceIndependenceMetadata: [
      meta('root_a', 'a', { rdapRegistrantHash: 'sha256:shared-registrant' }),
      meta('root_b', 'b', { rdapRegistrantHash: 'sha256:shared-registrant' }),
    ],
  });

  assert.equal(withSignals.independentLineageCount, 1, 'clustered lineages collapse to one');
  assert.ok(withSignals.score < withoutSignals.score, 'collapsing clustered lineages lowers the score');
  assert.equal(withSignals.passesPublishThreshold, false, 'the discounted score falls below threshold');
  assert.equal(withSignals.sourceIndependence.sharedInfrastructureFindings.length, 1);
  assert.equal(withSignals.sourceIndependence.sharedInfrastructureFindings[0]?.kind, 'shared_registrant');
  assert.deepEqual(withSignals.sourceIndependence.sharedInfrastructureClusters, [
    { canonicalLineageRootId: 'root_a', lineageRootIds: ['root_a', 'root_b'] },
  ]);
});

test('shared ASN produces the same collapse as shared registrant', () => {
  const links = [evidence('a', 'root_a'), evidence('b', 'root_b')];
  const result = recalculateConfidenceWithSybilSignals({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    referenceDate: FIXED_NOW,
    policy: POLICY,
    sourceIndependenceMetadata: [
      meta('root_a', 'a', { asn: 'AS64500' }),
      meta('root_b', 'b', { asn: 'AS64500' }),
    ],
  });
  assert.equal(result.independentLineageCount, 1);
  assert.equal(result.sourceIndependence.sharedInfrastructureFindings[0]?.kind, 'shared_asn');
});

test('shared nameserver overlap collapses a three-way cluster transitively', () => {
  const links = [evidence('a', 'root_a'), evidence('b', 'root_b'), evidence('c', 'root_c')];
  const { clusters } = detectSharedInfrastructureClusters([
    meta('root_a', 'a', { nameservers: ['ns1.example', 'ns2.example'] }),
    meta('root_b', 'b', { nameservers: ['ns2.example', 'ns3.example'] }),
    meta('root_c', 'c', { nameservers: ['ns3.example', 'ns4.example'] }),
  ]);
  assert.deepEqual(clusters, [
    { canonicalLineageRootId: 'root_a', lineageRootIds: ['root_a', 'root_b', 'root_c'] },
  ]);

  const collapsed = collapseSharedInfrastructureLineages(links, clusters);
  assert.ok(collapsed.every((link) => link.lineageRootId === 'root_a'));
  // Original links are untouched.
  assert.equal(links[1]?.lineageRootId, 'root_b');
});

test('unrelated sources are never collapsed and reproduce the same score', () => {
  const links = [evidence('a', 'root_a'), evidence('b', 'root_b')];
  const base = recalculateConfidence({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    policy: POLICY,
  });
  const withSignals = recalculateConfidenceWithSybilSignals({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    referenceDate: FIXED_NOW,
    policy: POLICY,
    sourceIndependenceMetadata: [
      meta('root_a', 'a', { domain: 'independent-one.example' }),
      meta('root_b', 'b', { domain: 'independent-two.example' }),
    ],
  });
  assert.equal(withSignals.score, base.score);
  assert.equal(withSignals.independentLineageCount, base.independentLineageCount);
  assert.deepEqual(withSignals.sourceIndependence.sharedInfrastructureClusters, []);
});

test('co-registration timing and near-simultaneous publication are advisory only and never change the score', () => {
  const links = [evidence('a', 'root_a'), evidence('b', 'root_b')];
  const base = recalculateConfidence({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    policy: POLICY,
  });
  const withSignals = recalculateConfidenceWithSybilSignals({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    referenceDate: FIXED_NOW,
    policy: POLICY,
    sourceIndependenceMetadata: [
      meta('root_a', 'a', {
        domainRegisteredAt: '2026-01-01T00:00:00.000Z',
        publishedAt: '2026-07-15T00:00:00.000Z',
      }),
      meta('root_b', 'b', {
        domainRegisteredAt: '2026-01-10T00:00:00.000Z',
        publishedAt: '2026-07-15T10:00:00.000Z',
      }),
    ],
  });

  assert.equal(withSignals.score, base.score, 'advisory-only signals never change the score');
  assert.equal(withSignals.independentLineageCount, base.independentLineageCount);
  assert.equal(withSignals.sourceIndependence.advisory.coRegistration.length, 1);
  assert.equal(withSignals.sourceIndependence.advisory.nearSimultaneousPublication.length, 1);
  assert.ok(withSignals.sourceIndependence.advisory.independenceDiscount > 0);
});

test('a freshly first-seen domain is flagged as an advisory recency signal', () => {
  const signals = assessAdvisorySignals({
    metadata: [meta('root_a', 'a', { domainFirstSeenAt: '2026-07-01T00:00:00.000Z' })],
    referenceDate: FIXED_NOW,
  });
  assert.equal(signals.recentFirstSeen.length, 1);
  assert.equal(signals.recentFirstSeen[0]?.lineageRootId, 'root_a');
  assert.ok(signals.independenceDiscount > 0);

  const stale = assessAdvisorySignals({
    metadata: [meta('root_a', 'a', { domainFirstSeenAt: '2020-01-01T00:00:00.000Z' })],
    referenceDate: FIXED_NOW,
  });
  assert.equal(stale.recentFirstSeen.length, 0);
  assert.equal(stale.independenceDiscount, 0);
});

test('low-trust corroboration alone, however numerous, never reaches published confidence', () => {
  const links = [
    evidence('a', 'root_a'),
    evidence('b', 'root_b'),
    evidence('c', 'root_c'),
  ];
  const base = recalculateConfidence({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    policy: POLICY,
  });
  assert.equal(base.passesPublishThreshold, true, 'base engine would otherwise publish');

  const withGate = recalculateConfidenceWithSybilSignals({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    referenceDate: FIXED_NOW,
    policy: POLICY,
  });
  assert.equal(withGate.topTier.topTierSourcePresent, false);
  assert.equal(withGate.passesPublishThreshold, false, 'top-tier gate blocks publication');
});

test('adding one top-tier source satisfies the gate', () => {
  const links = [
    evidence('a', 'root_a'),
    evidence('b', 'root_b'),
    evidence('c', 'root_c'),
    evidence('d', 'root_d', { sourceClassification: 'government_record' }),
  ];
  const result = recalculateConfidenceWithSybilSignals({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    referenceDate: FIXED_NOW,
    policy: POLICY,
  });
  assert.equal(result.topTier.topTierSourcePresent, true);
  assert.deepEqual(result.topTier.topTierLineageRootIds, ['root_d']);
  assert.equal(result.passesPublishThreshold, true);
});

test('a non-credible or contradicting top-tier link does not satisfy the gate', () => {
  const links = [
    evidence('a', 'root_a'),
    evidence('b', 'root_b', { sourceClassification: 'government_record', credible: false }),
    evidence('c', 'root_c', {
      sourceClassification: 'government_record',
      role: 'contradicting',
    }),
  ];
  const gate = evaluateTopTierSourceGate(links);
  assert.equal(gate.topTierSourcePresent, false);
});

test('omitting source-independence metadata reproduces recalculateConfidence exactly, aside from the added gate fields', () => {
  const links = [evidence('a', 'root_a'), evidence('b', 'root_b')];
  const base = recalculateConfidence({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    policy: POLICY,
  });
  const withSignals = recalculateConfidenceWithSybilSignals({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    referenceDate: FIXED_NOW,
    policy: POLICY,
  });

  assert.equal(withSignals.score, base.score);
  assert.deepEqual(withSignals.components, base.components);
  assert.equal(withSignals.independentLineageCount, base.independentLineageCount);
  assert.deepEqual(withSignals.audit, base.audit);
  assert.deepEqual(withSignals.sourceIndependence.sharedInfrastructureClusters, []);
});

test('shared-infrastructure detection is deterministic under reordering', () => {
  const metadata = [
    meta('root_c', 'c', { rdapRegistrantHash: 'sha256:shared' }),
    meta('root_a', 'a', { rdapRegistrantHash: 'sha256:shared' }),
    meta('root_b', 'b', { asn: 'AS64500' }),
  ];
  const first = detectSharedInfrastructureClusters(metadata);
  const second = detectSharedInfrastructureClusters([...metadata].reverse());
  assert.deepEqual(first, second);
});
