/**
 * Tests for the BB-035 kill-switch wiring on semantic search (BB-071).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateVectorSearchKillSwitch, VECTOR_SEARCH_KILL_SWITCH_ID } from './vector-search-kill-switch.ts';

test('vector search is allowed with an empty kill-switch snapshot (safe default)', () => {
  const decision = evaluateVectorSearchKillSwitch({});
  assert.equal(decision.allowed, true);
});

test('vector search is denied when the shared "search" switch is engaged', () => {
  const decision = evaluateVectorSearchKillSwitch({
    search: { id: 'search', enabled: true },
  });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.switchId, VECTOR_SEARCH_KILL_SWITCH_ID);
    assert.equal(decision.reason, 'switch-engaged');
  }
});

test('vector search is denied under public-static-mode, same as text search', () => {
  const decision = evaluateVectorSearchKillSwitch({
    'public-static-mode': { id: 'public-static-mode', enabled: true },
  });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.reason, 'static-read-only');
  }
});
