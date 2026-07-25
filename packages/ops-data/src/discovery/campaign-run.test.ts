/**
 * Unit tests for discovery campaign run builders, publish guard, and in-memory store.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discoveryCampaignRunSchema } from '../firestore/types.js';
import {
  assertDiscoveryRunCannotPublish,
  buildDiscoveryCampaignRunDoc,
  createInMemoryDiscoveryCampaignRunStore,
} from './campaign-run.js';

const BASE_INPUT = {
  id: 'dcr_rss_run_1',
  jobId: 'discovery-campaign-rss',
  jobRunId: 'jobrun_rss_run_1',
  status: 'success' as const,
  startedAt: '2026-07-18T14:00:00.000Z',
  completedAt: '2026-07-18T14:05:00.000Z',
  mode: 'fixture' as const,
  itemsExpected: 100,
  itemsProcessed: 42,
  survivors: 12,
  accepted: 10,
  kind: 'rss',
};

test('buildDiscoveryCampaignRunDoc sets private-only metadata and parses', () => {
  const doc = buildDiscoveryCampaignRunDoc(BASE_INPUT);
  assert.deepEqual(discoveryCampaignRunSchema.safeParse(doc).success, true);
  assert.equal(doc.publicEffect, 'none');
  assert.equal(doc.killSwitchId, 'research-campaigns');
  assert.equal(doc.createdAt, BASE_INPUT.completedAt);
  assert.equal(doc.survivors, 12);
  assert.equal(doc.accepted, 10);
  assert.equal(doc.kind, 'rss');
});

test('buildDiscoveryCampaignRunDoc accepts skipped_kill_switch and error statuses', () => {
  const skipped = buildDiscoveryCampaignRunDoc({
    ...BASE_INPUT,
    id: 'dcr_skipped',
    status: 'skipped_kill_switch',
    itemsProcessed: 0,
    survivors: undefined,
    accepted: undefined,
    kind: undefined,
  });
  assert.equal(skipped.status, 'skipped_kill_switch');

  const errored = buildDiscoveryCampaignRunDoc({
    ...BASE_INPUT,
    id: 'dcr_error',
    status: 'error',
    errorMessage: 'fixture feed missing',
    itemsProcessed: 0,
  });
  assert.equal(errored.errorMessage, 'fixture feed missing');
});

test('assertDiscoveryRunCannotPublish passes for publicEffect none', () => {
  const doc = buildDiscoveryCampaignRunDoc(BASE_INPUT);
  assert.doesNotThrow(() => assertDiscoveryRunCannotPublish(doc));
});

test('assertDiscoveryRunCannotPublish throws when publicEffect is not none', () => {
  const doc = buildDiscoveryCampaignRunDoc(BASE_INPUT);
  const tampered = { ...doc, publicEffect: 'auto-publish' as 'none' };
  assert.throws(() => assertDiscoveryRunCannotPublish(tampered), /cannot publish/);
});

test('in-memory store saves and retrieves by run id', () => {
  const store = createInMemoryDiscoveryCampaignRunStore();
  const doc = buildDiscoveryCampaignRunDoc(BASE_INPUT);
  store.save(doc);
  assert.deepEqual(store.get(BASE_INPUT.id), doc);
  assert.equal(store.get('missing'), undefined);
});

test('in-memory store rejects invalid documents', () => {
  const store = createInMemoryDiscoveryCampaignRunStore();
  assert.throws(() => store.save({ id: 'bad' } as never), /Required|Invalid/);
});
