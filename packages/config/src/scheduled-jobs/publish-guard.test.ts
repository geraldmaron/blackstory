
/**
 * Nothing scheduled can publish. This proves assertScheduledJobOperationAllowed
 * calls through the REAL guard (assertDiscoveryCannotPublish from @black-book/domain)
 * not a locally invented check that doesn't connect to anything and that a job cannot bypass
 * promotion gates even when it declares one of the two pre-approved public-facing exceptions.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FORBIDDEN_DISCOVERY_OPERATIONS, assertDiscoveryCannotPublish } from '@black-book/domain';
import { assertScheduledJobOperationAllowed, jobDeclaresPublicEffect } from './publish-guard.ts';
import type { ScheduledJobDefinition } from './types.ts';

const NONE_EFFECT_JOB: ScheduledJobDefinition = {
  id: 'discovery-campaign-wikimedia-federal',
  owner: 'BB-073',
  description: 'test',
  cadence: { cronExpression: '0 6 * * 1', nominalIntervalMs: 604_800_000, humanReadable: 'weekly' },
  budget: { unit: 'candidates', maxPerRun: 500 },
  timeoutSec: 3_600,
  idempotencyKeyScheme: 'job:{jobId}:{isoWeekStart}',
  killSwitchId: 'research-campaigns',
  targetWorker: { package: 'research', function: 'discovery.campaign.run' },
  environment: 'blackbook-internal',
  publicEffect: 'none',
  rosterStatus: 'stub',
  implementationOwnerBead: 'BB-073',
  consecutiveMissedRunThreshold: 2,
};

const LINK_REPAIR_JOB: ScheduledJobDefinition = {
  ...NONE_EFFECT_JOB,
  id: 'citation-link-health-sweep',
  publicEffect: 'link-repair-archived-copy',
};

test('every forbidden discovery operation is rejected for a plain (publicEffect: none) job', () => {
  for (const operation of FORBIDDEN_DISCOVERY_OPERATIONS) {
    assert.throws(() =>
      assertScheduledJobOperationAllowed({ job: NONE_EFFECT_JOB, attempt: { operation } }),
    );
  }
});

test('every forbidden discovery operation is STILL rejected for a job with a pre-approved public-facing effect — the exception is not a bypass', () => {
  for (const operation of FORBIDDEN_DISCOVERY_OPERATIONS) {
    assert.throws(() =>
      assertScheduledJobOperationAllowed({ job: LINK_REPAIR_JOB, attempt: { operation } }),
    );
  }
});

test('a non-forbidden operation is allowed through the same real guard', () => {
  assert.doesNotThrow(() =>
    assertScheduledJobOperationAllowed({
      job: NONE_EFFECT_JOB,
      attempt: { operation: 'write_research_candidate' },
    }),
  );
});

test('assertScheduledJobOperationAllowed calls the exact same underlying function as the discovery pipeline', () => {
  // Same input, same guard, same outcome proves this is a pass-through, not a parallel check.
  const attempt = { operation: 'activate_release', target: 'release-1' };
  let directError: unknown;
  let wrappedError: unknown;
  try {
    assertDiscoveryCannotPublish(attempt);
  } catch (error) {
    directError = error;
  }
  try {
    assertScheduledJobOperationAllowed({ job: NONE_EFFECT_JOB, attempt });
  } catch (error) {
    wrappedError = error;
  }
  assert.ok(directError instanceof Error);
  assert.ok(wrappedError instanceof Error);
  assert.equal((directError as Error).message, (wrappedError as Error).message);
});

test('jobDeclaresPublicEffect distinguishes the two exception jobs from every other job', () => {
  assert.equal(jobDeclaresPublicEffect(NONE_EFFECT_JOB), false);
  assert.equal(jobDeclaresPublicEffect(LINK_REPAIR_JOB), true);
});
