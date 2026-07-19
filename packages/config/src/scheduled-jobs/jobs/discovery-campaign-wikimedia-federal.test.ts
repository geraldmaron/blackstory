/**
 * Smoke test for the Wikimedia + federal discovery scheduled job wrapper.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runDiscoveryCampaignWikimediaFederalJob } from './discovery-campaign-wikimedia-federal.ts';

test('wikimedia+federal discovery job completes with survivors and no publish path', async () => {
  const result = await runDiscoveryCampaignWikimediaFederalJob({
    jobRunId: 'wikimedia-federal-run-1',
    startedAt: '2026-07-19T10:00:00.000Z',
    completedAt: '2026-07-19T10:30:00.000Z',
  });

  assert.equal(result.run.status, 'success');
  assert.equal(result.run.jobId, 'discovery-campaign-wikimedia-federal');
  assert.ok(result.campaign.summary.survivors >= 2);
  assert.equal(result.campaign.kind, 'wikimedia-federal-discovery.v1');
  assert.equal(result.campaign.perAdapterYield.length, 6);
});
