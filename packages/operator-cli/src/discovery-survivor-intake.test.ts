/**
 * Unit tests for discovery survivor → lead intake bridge (prepare only, no commit).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { runWebSearchCampaign } from '@repo/domain';
import { prepareDiscoverySurvivorIntake } from './discovery-survivor-intake.ts';
import type { OperatorIntakeContext } from './intake.ts';

const FIXED_NOW_MS = 1_721_400_000_000;
const FIXED_ISO = '2026-07-19T00:00:00.000Z';
const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'domain',
  'src',
  'adapters',
  'web-search',
  'fixtures',
  'searxng-search-response.json',
);

function context(): OperatorIntakeContext {
  return {
    identity: {
      operatorId: 'op_test',
      sessionId: 'sess_test',
      source: 'cli',
    },
    privacyPepper: 'test-privacy-pepper-not-a-secret-value',
    nowMs: FIXED_NOW_MS,
  };
}

test('prepareDiscoverySurvivorIntake opens draft cases for SearXNG campaign survivors', async () => {
  const campaignResult = await runWebSearchCampaign({
    providerConfig: {
      provider: 'searxng',
      apiKey: '',
      storageTermsConfirmed: true,
      planTermsVersion: 'searxng-self-hosted-research-2026-07',
    },
    searchResponseRaw: JSON.parse(readFileSync(FIXTURE, 'utf8')),
    stampedAt: FIXED_ISO,
    completedAt: FIXED_ISO,
    requireWaybackCapture: false,
  });

  const intake = prepareDiscoverySurvivorIntake({
    campaign: campaignResult.campaign,
    context: context(),
    maxSurvivors: 10,
  });

  assert.ok(intake.prepared >= 2);
  assert.equal(
    intake.items.every((item) => item.outcome.accepted),
    true,
  );
  const first = intake.items[0];
  assert.ok(first);
  if (first.outcome.accepted) {
    assert.ok(first.outcome.researchCase?.id);
    assert.equal(first.outcome.researchCase?.state, 'candidate');
  }
});

test('prepareDiscoverySurvivorIntake respects maxSurvivors cap', async () => {
  const campaignResult = await runWebSearchCampaign({
    providerConfig: {
      provider: 'searxng',
      apiKey: '',
      storageTermsConfirmed: true,
      planTermsVersion: 'searxng-self-hosted-research-2026-07',
    },
    searchResponseRaw: JSON.parse(readFileSync(FIXTURE, 'utf8')),
    stampedAt: FIXED_ISO,
    completedAt: FIXED_ISO,
    requireWaybackCapture: false,
  });

  const intake = prepareDiscoverySurvivorIntake({
    campaign: campaignResult.campaign,
    context: context(),
    maxSurvivors: 1,
  });
  assert.equal(intake.considered, 1);
  assert.equal(intake.prepared, 1);
});
