/**
 * Tests for story-research-run: mock recommend with resolved cites, fail-closed
 * without cites, and story_packet quarantine intake (prepare-only).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareStoryPacketIntake } from './story-intake.ts';
import { runStoryResearch } from './story-research-run.ts';

const NOW = '2026-07-18T12:00:00.000Z';
const identity = {
  operatorId: 'operator-story-1',
  sessionId: 'session-story-1',
  source: 'cli' as const,
};

test('mock story-research-run recommends when published claims and off-ramps resolve', async () => {
  const result = await runStoryResearch({
    topics: [
      {
        topicId: 'topic-alamo-start-line',
        title: 'Before the battle cry',
        eraLabel: '1821–1848',
        placeLabel: 'Texas',
        relatedEntityIds: ['ent_alamo_mission'],
        relatedFactIds: ['BB-F-TX-1836'],
        publishedClaims: [
          {
            id: 'claim_clarissa_indenture',
            workflowStatus: 'accepted',
            publicationStatus: 'published',
            label: 'Clarissa indenture',
            role: 'named_case',
          },
          {
            id: 'claim_joe_survivor',
            workflowStatus: 'accepted',
            publicationStatus: 'published',
            label: 'Joe at the Alamo',
            role: 'omitted',
          },
        ],
        authorityLeadHints: ['https://www.nps.gov/subjects/alamo/index.htm'],
      },
    ],
    identity,
    nowIso: NOW,
  });

  assert.equal(result.kind, 'story.research.run.v1');
  assert.equal(result.recommendCount, 1);
  assert.equal(result.items[0]?.packet.decision, 'recommend');
  assert.equal(result.items[0]?.packet.validationIssues.length, 0);
  assert.ok(result.items[0]?.packet.draft.body.length > 0);
});

test('mock story-research-run demotes to needs_evidence without publishable cites', async () => {
  const result = await runStoryResearch({
    topics: [
      {
        topicId: 'topic-thin',
        title: 'Thin topic',
        relatedEntityIds: [],
        relatedFactIds: [],
        publishedClaims: [
          {
            id: 'claim_unpublished',
            workflowStatus: 'accepted',
            publicationStatus: 'unpublished',
            label: 'Not ready',
            role: 'named_case',
          },
        ],
      },
    ],
    identity,
    nowIso: NOW,
  });

  assert.equal(result.recommendCount, 0);
  assert.equal(result.items[0]?.packet.decision, 'needs_evidence');
  assert.ok(result.items[0]!.packet.validationIssues.length > 0);
});

test('prepareStoryPacketIntake stages story_packet without publish fields', () => {
  return runStoryResearch({
    topics: [
      {
        topicId: 'topic-stage',
        title: 'Staging topic',
        eraLabel: '1900s',
        placeLabel: 'Washington, D.C.',
        relatedEntityIds: ['ent_dunbar_school_001'],
        relatedFactIds: ['BB-F-000001'],
        publishedClaims: [
          {
            id: 'claim_seed_1',
            workflowStatus: 'accepted',
            publicationStatus: 'published',
            role: 'named_case',
          },
        ],
      },
    ],
    identity,
    nowIso: NOW,
  }).then((result) => {
    const packet = result.items[0]!.packet;
    const outcome = prepareStoryPacketIntake(packet, {
      identity,
      privacyPepper: 'test-only-pepper-story',
      nowMs: Date.parse(NOW),
    });
    assert.equal(outcome.accepted, true);
    if (!outcome.accepted) return;
    assert.equal(outcome.proposalKind, 'story_packet');
    assert.equal(Object.hasOwn(outcome, 'approved'), false);
    assert.equal(Object.hasOwn(outcome, 'published'), false);
    assert.equal(Object.hasOwn(outcome, 'releaseId'), false);
  });
});
