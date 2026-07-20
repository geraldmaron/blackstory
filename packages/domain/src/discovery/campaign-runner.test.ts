/**
 * Tests for shared discovery campaign-runner helpers.
 * Validates no-publish guard, snippet caps, survivor listing, optional relevance/graylist
 * partition, yield summary, and optional editorial hook (mock only).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FORBIDDEN_DISCOVERY_OPERATIONS } from './guard.js';
import type { DiscoveryCampaignResult, DiscoveryCandidateRecord } from './types.js';
import {
  CAMPAIGN_RUNNER_HELPERS_VERSION,
  assertCampaignCannotPublish,
  assertSurvivorSnippetsCapped,
  listCampaignSurvivors,
  partitionSurvivorsByRelevance,
  runOptionalEditorialHook,
  summarizeCampaignYield,
  toEditorialLeadPreview,
} from './campaign-runner.js';

const FIXED_NOW = '2026-07-18T00:00:00.000Z';

function buildCandidate(
  overrides: Partial<DiscoveryCandidateRecord> = {},
): DiscoveryCandidateRecord {
  const base: DiscoveryCandidateRecord = {
    schemaVersion: 'discovery-candidate.v1',
    id: 'disc_rss_1',
    identity: {
      identityKey: 'identity_key_1',
      stableIdentifier: 'rss:feed_x:abc123',
      contentHash: { algorithm: 'sha256', digest: 'a'.repeat(64) },
      sourceReferences: [],
    },
    adapterRecord: {
      stableIdentifier: 'rss:feed_x:abc123',
      title: 'Rosewood Community Newsletter mentions local school history',
      canonicalUrl: 'https://example.org/newsletter',
      classification: 'community_oral',
      payload: { summary: 'A short capped summary for Rosewood school history.' },
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
    status: 'accepted',
    ingestMode: 'api',
    signals: {
      strength: 'weak',
      outcome: 'candidate_only',
      matchedClasses: ['geographic'],
      matchedTerms: ['Rosewood'],
      reasons: ['weak geographic match'],
    },
    geographicHints: [],
    retryCount: 0,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
  return { ...base, ...overrides };
}

function buildCampaign(candidates: readonly DiscoveryCandidateRecord[]): DiscoveryCampaignResult {
  return {
    campaignId: 'camp_test',
    run: {
      runId: 'run_1',
      adapterId: 'rss',
      startedAt: FIXED_NOW,
      entityKind: 'person',
      theme: 'civil_rights',
      stampedAt: FIXED_NOW,
      contentFingerprint: 'fp',
    },
    pack: { id: 'qp_test', versionId: 'qp_test_v1', version: '1.0.0' },
    reproducibility: {
      stampedAt: FIXED_NOW,
      packVersionId: 'qp_test_v1',
      contentFingerprint: 'fp',
      adapterIds: ['rss'],
    },
    candidates,
    acceptedCount: candidates.filter((c) => c.status === 'accepted').length,
    quarantinedCount: candidates.filter((c) => c.status === 'quarantined').length,
    deadLetterCount: candidates.filter((c) => c.status === 'dead_letter').length,
    mergedCount: candidates.filter((c) => c.status === 'merged').length,
    skippedCount: 0,
    completedAt: FIXED_NOW,
  };
}

test('assertCampaignCannotPublish confirms guard is armed and rejects forbidden attempts', () => {
  assert.doesNotThrow(() => assertCampaignCannotPublish());
  assert.ok(FORBIDDEN_DISCOVERY_OPERATIONS.length >= 4);
  assert.throws(
    () => assertCampaignCannotPublish({ operation: 'create_public_entity' }),
    /Discovery cannot publish/,
  );
  assert.doesNotThrow(() => assertCampaignCannotPublish({ operation: 'ingest_candidate' }));
});

test('assertSurvivorSnippetsCapped passes capped summaries and rejects oversize prose', () => {
  assert.doesNotThrow(() => assertSurvivorSnippetsCapped([buildCandidate()]));
  assert.throws(
    () =>
      assertSurvivorSnippetsCapped([
        buildCandidate({
          adapterRecord: {
            ...buildCandidate().adapterRecord,
            payload: { summary: 'word '.repeat(80).trim() },
          },
        }),
      ]),
    /exceeds (320 chars|60 words)/,
  );
});

test('listCampaignSurvivors returns accepted and merged only', () => {
  const survivors = listCampaignSurvivors(
    buildCampaign([
      buildCandidate({ id: 'a', status: 'accepted' }),
      buildCandidate({ id: 'b', status: 'merged' }),
      buildCandidate({ id: 'c', status: 'quarantined' }),
      buildCandidate({ id: 'd', status: 'dead_letter' }),
    ]),
  );
  assert.deepEqual(
    survivors.map((c) => c.id),
    ['a', 'b'],
  );
});

test('partitionSurvivorsByRelevance defaults off (all survivors research-eligible)', () => {
  const survivors = [buildCandidate()];
  const result = partitionSurvivorsByRelevance({
    survivors,
    assessedAt: FIXED_NOW,
  });
  assert.equal(result.researchEligible.length, 1);
  assert.equal(result.graylisted.length, 0);
});

test('partitionSurvivorsByRelevance parks weak uncorroborated leads when enabled', () => {
  const survivors = [buildCandidate()];
  const result = partitionSurvivorsByRelevance({
    survivors,
    assessedAt: FIXED_NOW,
    enabled: true,
  });
  assert.equal(result.researchEligible.length, 0);
  assert.equal(result.graylisted.length, 1);
  assert.equal(result.graylisted[0]?.candidateId, 'disc_rss_1');
});

test('summarizeCampaignYield reports counts without throwing on armed guard', () => {
  const campaign = buildCampaign([
    buildCandidate({ id: 'a', status: 'accepted' }),
    buildCandidate({ id: 'q', status: 'quarantined' }),
  ]);
  const summary = summarizeCampaignYield({
    campaign,
    graylistedCount: 0,
    researchEligibleCount: 1,
  });
  assert.equal(summary.helpersVersion, CAMPAIGN_RUNNER_HELPERS_VERSION);
  assert.equal(summary.accepted, 1);
  assert.equal(summary.quarantined, 1);
  assert.equal(summary.survivors, 1);
  assert.equal(summary.researchEligible, 1);
  assert.equal(summary.graylisted, 0);
});

test('toEditorialLeadPreview and runOptionalEditorialHook (mock LLM)', async () => {
  const preview = toEditorialLeadPreview(buildCandidate());
  assert.equal(preview.candidateId, 'disc_rss_1');
  assert.match(preview.summary ?? '', /Rosewood/);

  const reviewed = await runOptionalEditorialHook(
    {
      reviewTopN: 1,
      review: (leads) =>
        leads.map((lead) => ({
          candidateId: lead.candidateId,
          decision: 'keep' as const,
          reason: 'mock editorial keep',
        })),
    },
    [preview],
  );
  assert.equal(reviewed.length, 1);
  assert.equal(reviewed[0]?.decision, 'keep');
});
