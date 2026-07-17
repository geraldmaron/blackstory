/**
 * BB-035 acceptance tests for independent, default-safe runtime kill switches.
 * Covers static read-only serving, queue retention, adapter isolation, and containment order.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  containmentOrder,
  evaluateKillSwitch,
  evaluatePublicRuntimeMode,
  evaluateQueueProcessingMode,
  sourceAdapterKillSwitchId,
  type KillSwitchId,
  type KillSwitchSnapshot,
} from './kill-switches.ts';

function state(id: KillSwitchId, enabled: boolean): KillSwitchSnapshot {
  return { [id]: { id, enabled } };
}

test('missing optional workloads fail closed while public corpus stays available', () => {
  assert.deepEqual(evaluateKillSwitch('llm-calls', {}), {
    allowed: false,
    switchId: 'llm-calls',
    policyVersion: '1.0.0',
    source: 'safe-default',
    reason: 'missing-optional-flag',
    failClosed: true,
  });
  assert.equal(evaluateKillSwitch('search', {}).allowed, true);
  assert.equal(evaluatePublicRuntimeMode({}).publicCorpusAvailable, true);
});

test('static mode is read-only and preserves immutable public snapshots', () => {
  const snapshot = state('public-static-mode', true);
  assert.deepEqual(evaluatePublicRuntimeMode(snapshot), {
    mode: 'static-read-only',
    readOnly: true,
    publicCorpusAvailable: true,
    releaseSource: 'immutable-release-snapshot',
  });
  assert.equal(evaluateKillSwitch('corrections-submissions', snapshot).allowed, false);
  assert.equal(evaluateKillSwitch('publication', snapshot).allowed, false);
  const adapter = sourceAdapterKillSwitchId('nara-catalog-v1');
  assert.equal(
    evaluateKillSwitch(adapter, {
      ...snapshot,
      [adapter]: { id: adapter, enabled: false },
    }).allowed,
    false,
  );
});

test('engaging one switch does not engage independent services', () => {
  const snapshot = state('geocoding', true);
  assert.equal(evaluateKillSwitch('geocoding', snapshot).allowed, false);
  assert.equal(
    evaluateKillSwitch('search', {
      ...snapshot,
      search: { id: 'search', enabled: false },
    }).allowed,
    true,
  );
  assert.equal(evaluatePublicRuntimeMode(snapshot).mode, 'dynamic');
});

test('individual source adapters fail closed and remain independent', () => {
  const nara = sourceAdapterKillSwitchId('nara-catalog-v1');
  const wire = sourceAdapterKillSwitchId('wire-feed-v0');
  const snapshot: KillSwitchSnapshot = {
    [nara]: { id: nara, enabled: true },
    [wire]: { id: wire, enabled: false },
  };

  assert.equal(evaluateKillSwitch(nara, snapshot).allowed, false);
  assert.equal(evaluateKillSwitch(wire, snapshot).allowed, true);
  assert.equal(evaluateKillSwitch(sourceAdapterKillSwitchId('missing'), snapshot).allowed, false);
});

test('queue pause retains queued tasks and permits durable enqueue', () => {
  assert.deepEqual(evaluateQueueProcessingMode(state('queue-processing', true)), {
    paused: true,
    acceptNewTasks: true,
    retainQueuedTasks: true,
  });
});

test('optional and volume workloads stop before static public serving', () => {
  const order = containmentOrder(['nara-catalog-v1']);
  const staticIndex = order.indexOf('public-static-mode');
  for (const id of [
    'research-campaigns',
    'llm-calls',
    'geocoding',
    'source-adapter-nara-catalog-v1',
    'corrections-submissions',
    'search',
  ] as const) {
    assert.ok(order.indexOf(id) >= 0, `${id} must appear in containment order`);
    assert.ok(order.indexOf(id) < staticIndex, `${id} must stop before public static serving`);
  }
});

test('adapter ids reject unsafe runtime key material', () => {
  assert.throws(() => sourceAdapterKillSwitchId('../escape'));
  assert.throws(() => sourceAdapterKillSwitchId(''));
});
