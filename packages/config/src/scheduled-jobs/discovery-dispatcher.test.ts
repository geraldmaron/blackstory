/**
 * Tests for discovery campaign dispatcher (fixture mode + kill-switch gate).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DISCOVERY_DISPATCHER_VERSION,
  dispatchDiscoveryCampaign,
  disengagedResearchCampaignsSnapshot,
} from './discovery-dispatcher.js';

const FIXED_NOW = '2026-07-19T01:00:00.000Z';

test('fixture community-obscurity dispatch succeeds when kill switch disengaged', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'community-obscurity-discovery',
    mode: 'fixture',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
    jobRunId: 'run_test_obscurity',
    maxCandidates: 20,
  });
  assert.equal(result.dispatcherVersion, DISCOVERY_DISPATCHER_VERSION);
  assert.equal(result.status, 'success');
  assert.equal(result.publicEffect, 'none');
  assert.ok((result.summary.itemsProcessed ?? 0) >= 1);
  assert.equal(result.summary.kind, 'community-obscurity.v1');
});

test('fixture wikimedia-federal dispatch succeeds', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-wikimedia-federal',
    mode: 'fixture',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
    jobRunId: 'run_test_wm',
    maxCandidates: 30,
  });
  assert.equal(result.status, 'success');
  assert.ok((result.summary.survivors ?? 0) >= 1);
});

test('fixture archive-dpla dispatch succeeds', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-archive-dpla',
    mode: 'fixture',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
    jobRunId: 'run_test_archive',
    maxCandidates: 20,
  });
  assert.equal(result.status, 'success');
  assert.ok((result.summary.survivors ?? 0) >= 1);
});

test('fixture rss dispatch succeeds', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-rss',
    mode: 'fixture',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
    jobRunId: 'run_test_rss',
    maxCandidates: 20,
  });
  assert.equal(result.status, 'success');
  assert.ok((result.summary.survivors ?? 0) >= 1);
});

test('fixture web-search dispatch succeeds with test storage terms', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-web-search',
    mode: 'fixture',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
    jobRunId: 'run_test_web',
    maxCandidates: 10,
  });
  assert.equal(result.status, 'success');
  assert.ok((result.summary.survivors ?? 0) >= 1);
});

test('engaged kill switch skips without running campaign', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-rss',
    mode: 'fixture',
    killSwitchEngaged: true,
    nowIso: FIXED_NOW,
  });
  assert.equal(result.status, 'skipped_kill_switch');
  assert.equal(result.run, undefined);
});

test('missing kill-switch snapshot fails closed (deny)', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-rss',
    mode: 'fixture',
    killSwitchSnapshot: {},
    nowIso: FIXED_NOW,
  });
  assert.equal(result.status, 'skipped_kill_switch');
});

test('disengagedResearchCampaignsSnapshot allows dispatch', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-rss',
    mode: 'fixture',
    killSwitchSnapshot: disengagedResearchCampaignsSnapshot(FIXED_NOW),
    nowIso: FIXED_NOW,
    jobRunId: 'run_test_snapshot',
  });
  assert.equal(result.status, 'success');
});

test('unknown job id returns error', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'not-a-real-job',
    mode: 'fixture',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
  });
  assert.equal(result.status, 'error');
});

test('live rss without DISCOVERY_FEED_XML returns error', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-rss',
    mode: 'live',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
    environment: {},
  });
  assert.equal(result.status, 'error');
  assert.match(result.summary.message ?? '', /DISCOVERY_FEED_XML/);
});
