/**
 * Low-authority source tiers (`community_oral` / `self_published` / `news_reportage`) cannot
 * independently reach include (weak-signal rule holds); crowdsourced items seed research cases
 * and never publish directly. Exercises the additive source-tier trust wiring in
 * `../../relevance/gates.ts` and `../../confidence-engine/engine.ts` against realistic RSS /
 * Internet Archive / DPLA-shaped candidates and evidence links.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateCandidateRelevance } from '../../relevance/engine.js';
import {
  enforceLowAuthorityTierCannotIncludeIndependently,
  isLowAuthoritySourceTier,
  LOW_AUTHORITY_SOURCE_TIERS,
} from '../../relevance/gates.js';
import {
  enforceCrowdsourcedCannotPublishAlone,
  isCrowdsourcedClaimSourceTier,
  isPurelyCrowdsourcedEvidence,
  type EvidenceSourceTierSummary,
} from '../../confidence-engine/engine.js';
import type { DiscoveryCandidateRecord } from '../../discovery/types.js';

const FIXED_NOW = '2026-07-17T20:00:00.000Z';

function communityCandidate(overrides: Partial<DiscoveryCandidateRecord> = {}): DiscoveryCandidateRecord {
  const base: DiscoveryCandidateRecord = {
    schemaVersion: 'discovery-candidate.v1',
    id: 'disc_rss_weak_1',
    identity: {
      identityKey: 'key_1',
      stableIdentifier: 'rss:feed_x:abc',
      contentHash: { algorithm: 'sha256', digest: 'a'.repeat(64) },
      sourceReferences: [],
    },
    adapterRecord: {
      stableIdentifier: 'rss:feed_x:abc',
      title: 'Community newsletter mentions a local family',
      canonicalUrl: 'https://example.org/newsletter',
      classification: 'community_oral',
      payload: {},
      provenance: {
        sourceId: 'src_rss',
        adapterId: 'rss',
        parserVersion: 'rss-parser-1.0.0',
        registryEntryId: 'reg_rss',
        runId: 'run_1',
        capturedAt: FIXED_NOW,
        schemaVersion: 'candidate-record.v1',
      },
    },
    status: 'pending',
    ingestMode: 'api',
    signals: {
      strength: 'weak',
      outcome: 'candidate_only',
      matchedClasses: ['geographic'],
      matchedTerms: ['Piedmont County'],
      reasons: ['weak geographic-only match'],
    },
    geographicHints: [],
    retryCount: 0,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
  return { ...base, ...overrides };
}

test('LOW_AUTHORITY_SOURCE_TIERS matches the three constitution tiers this module maps', () => {
  assert.deepEqual([...LOW_AUTHORITY_SOURCE_TIERS].sort(), ['community_oral', 'news_reportage', 'self_published']);
  assert.equal(isLowAuthoritySourceTier('community_oral'), true);
  assert.equal(isLowAuthoritySourceTier('self_published'), true);
  assert.equal(isLowAuthoritySourceTier('news_reportage'), true);
  assert.equal(isLowAuthoritySourceTier('primary_archival'), false);
  assert.equal(isLowAuthoritySourceTier(undefined), false);
});

test('a weak-signal RSS/community_oral candidate does not independently reach include', () => {
  const candidate = communityCandidate();
  const assessment = evaluateCandidateRelevance({ candidate, assessedAt: FIXED_NOW });
  assert.notEqual(assessment.decision, 'include');
  // The hard downgrade is a no-op here because the existing gate pipeline already blocked it 
  // proving the two layers agree rather than fighting each other.
  assert.equal(enforceLowAuthorityTierCannotIncludeIndependently(candidate, assessment.decision), assessment.decision);
});

test('enforceLowAuthorityTierCannotIncludeIndependently downgrades a hypothetical include for an uncorroborated weak/low-tier candidate', () => {
  const candidate = communityCandidate();
  // Simulate a caller that (incorrectly) resolved this to include the hard gate must still catch it.
  assert.equal(enforceLowAuthorityTierCannotIncludeIndependently(candidate, 'include'), 'supporting_context');
});

test('enforceLowAuthorityTierCannotIncludeIndependently leaves strong-signal or non-low-tier candidates untouched', () => {
  const strongSignal = communityCandidate({
    signals: {
      strength: 'strong',
      outcome: 'promotable',
      matchedClasses: ['positive', 'historical'],
      matchedTerms: ['founded the first Black-owned bank in the county'],
      reasons: ['strong positive + historical match'],
    },
  });
  assert.equal(enforceLowAuthorityTierCannotIncludeIndependently(strongSignal, 'include'), 'include');

  const highAuthoritySource = communityCandidate({
    adapterRecord: { ...communityCandidate().adapterRecord, classification: 'primary_archival' },
  });
  assert.equal(enforceLowAuthorityTierCannotIncludeIndependently(highAuthoritySource, 'include'), 'include');
});

test('isPurelyCrowdsourcedEvidence / isCrowdsourcedClaimSourceTier identify RSS, Internet Archive default, and self-published tiers', () => {
  assert.equal(isCrowdsourcedClaimSourceTier('community_oral'), true); // internet_archive default classification
  assert.equal(isCrowdsourcedClaimSourceTier('news_reportage'), true); // rss news feeds
  assert.equal(isCrowdsourcedClaimSourceTier('self_published'), true); // rss personal blogs
  assert.equal(isCrowdsourcedClaimSourceTier('reputable_secondary'), false); // dpla v2 default

  const onlyCommunity: readonly EvidenceSourceTierSummary[] = [
    { lineageRootId: 'lineage_rss_1', sourceClassification: 'community_oral' },
  ];
  assert.equal(isPurelyCrowdsourcedEvidence(onlyCommunity), true);

  const mixed: readonly EvidenceSourceTierSummary[] = [
    { lineageRootId: 'lineage_rss_1', sourceClassification: 'community_oral' },
    { lineageRootId: 'lineage_federal_1', sourceClassification: 'government_record' },
  ];
  assert.equal(isPurelyCrowdsourcedEvidence(mixed), false);
  assert.equal(isPurelyCrowdsourcedEvidence([]), false);
});

test('enforceCrowdsourcedCannotPublishAlone caps passesPublishThreshold for single-lineage crowdsourced evidence even when the weighted score alone crossed the bar', () => {
  // Simulates the exact scenario the module header warns about: every other component maxed
  // out, only sourceAuthority low the weighted average alone can still be quite high.
  const highScoreResult = { passesPublishThreshold: true, score: 0.79 };
  const onlyRssEvidence: readonly EvidenceSourceTierSummary[] = [
    { lineageRootId: 'lineage_rss_1', sourceClassification: 'news_reportage' },
  ];

  const capped = enforceCrowdsourcedCannotPublishAlone(highScoreResult, onlyRssEvidence);
  assert.equal(capped.passesPublishThreshold, false);
  assert.equal(capped.score, 0.79); // score itself is untouched — still surfaces as a research lead.

  const corroborated: readonly EvidenceSourceTierSummary[] = [
    ...onlyRssEvidence,
    { lineageRootId: 'lineage_dpla_1', sourceClassification: 'reputable_secondary' },
  ];
  const uncapped = enforceCrowdsourcedCannotPublishAlone(highScoreResult, corroborated);
  assert.equal(uncapped.passesPublishThreshold, true);
});
