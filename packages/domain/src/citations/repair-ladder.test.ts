/**
 * the repair ladder, tested explicitly in order 
 * permanent_redirect -> wayback_swap -> retroactive_spn -> dead_mark.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Citation } from './citation.js';
import { decideRepairLadderStep, applyRepairLadder, REPAIR_LADDER_STEPS } from './repair-ladder.js';
import { buildSpnSaveUrl, interpretSpnFetchResult } from './spn-client.js';
import type { SpnCaptureOutcome } from './spn-client.js';

function baseCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    id: 'cit-1',
    claimId: 'claim-1',
    sourceName: 'Local Gazette',
    location: { kind: 'url', url: 'https://gazette.example/story/1' },
    capture: { captureId: 'capture-1' },
    retrievalDate: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('REPAIR_LADDER_STEPS is declared in the fixed acceptance-criterion order', () => {
  assert.deepEqual(REPAIR_LADDER_STEPS, [
    'permanent_redirect',
    'wayback_swap',
    'retroactive_spn',
    'dead_mark',
  ]);
});

test('step 1: a permanent redirect is preferred over every later step, even with a Wayback capture available', () => {
  const step = decideRepairLadderStep({
    classification: { status: 'redirected', permanentRedirect: true },
    hasWaybackCapture: true,
  });
  assert.equal(step, 'permanent_redirect');
});

test('step 2: a dead link with an existing Wayback capture swaps to it before attempting SPN', () => {
  const step = decideRepairLadderStep({
    classification: { status: 'dead' },
    hasWaybackCapture: true,
  });
  assert.equal(step, 'wayback_swap');
});

test('step 3: a dead link with no capture falls to a retroactive Save Page Now attempt', () => {
  const step = decideRepairLadderStep({
    classification: { status: 'dead' },
    hasWaybackCapture: false,
  });
  assert.equal(step, 'retroactive_spn');
});

test('applyRepairLadder: permanent redirect updates the location and preserves the original as originally-published-at', async () => {
  const citation = baseCitation();
  const outcome = await applyRepairLadder({
    citation,
    classification: { status: 'redirected', permanentRedirect: true, redirectTarget: 'https://gazette.example/archive/story-1' },
    attemptSpn: async () => {
      throw new Error('attemptSpn must not be called for a permanent-redirect repair');
    },
    now: '2026-07-17T00:00:00.000Z',
  });
  assert.equal(outcome.step, 'permanent_redirect');
  assert.deepEqual(outcome.citation.location, { kind: 'url', url: 'https://gazette.example/archive/story-1' });
  assert.equal(outcome.citation.originallyPublishedAtUrl, 'https://gazette.example/story/1');
  assert.equal(outcome.citation.linkStatus, 'alive');
});

test('applyRepairLadder: step 2 swaps to the stored Wayback capture and never calls attemptSpn', async () => {
  const citation = baseCitation({
    capture: { captureId: 'capture-1', waybackCaptureUrl: 'https://web.archive.org/web/20260101000000/https://gazette.example/story/1' },
  });
  const outcome = await applyRepairLadder({
    citation,
    classification: { status: 'dead' },
    attemptSpn: async () => {
      throw new Error('attemptSpn must not be called when a Wayback capture already exists');
    },
    now: '2026-07-17T00:00:00.000Z',
  });
  assert.equal(outcome.step, 'wayback_swap');
  assert.deepEqual(outcome.citation.location, {
    kind: 'url',
    url: 'https://web.archive.org/web/20260101000000/https://gazette.example/story/1',
  });
  assert.equal(outcome.citation.originallyPublishedAtUrl, 'https://gazette.example/story/1');
  assert.equal(outcome.citation.linkStatus, 'dead');
});

test('applyRepairLadder: step 3 attempts SPN only when no capture exists, and swaps to the fresh capture on success', async () => {
  const citation = baseCitation();
  let spnCalledWith: string | undefined;
  const outcome = await applyRepairLadder({
    citation,
    classification: { status: 'dead' },
    attemptSpn: async (url) => {
      spnCalledWith = url;
      return { ok: true, waybackCaptureUrl: 'https://web.archive.org/web/20260717000000/https://gazette.example/story/1', capturedAt: '2026-07-17T00:00:00.000Z' };
    },
    now: '2026-07-17T00:00:00.000Z',
  });
  assert.equal(spnCalledWith, 'https://gazette.example/story/1');
  assert.equal(outcome.step, 'retroactive_spn');
  assert.equal(outcome.citation.capture.waybackCaptureUrl, 'https://web.archive.org/web/20260717000000/https://gazette.example/story/1');
  assert.equal(outcome.citation.originallyPublishedAtUrl, 'https://gazette.example/story/1');
});

test('applyRepairLadder: step 4 marks dead only after step 3 (SPN) is attempted and fails', async () => {
  const citation = baseCitation();
  let spnAttempted = false;
  const outcome = await applyRepairLadder({
    citation,
    classification: { status: 'dead' },
    attemptSpn: async () => {
      spnAttempted = true;
      return { ok: false, reason: 'spn_unavailable' };
    },
    now: '2026-07-17T00:00:00.000Z',
  });
  assert.equal(spnAttempted, true, 'the ladder must attempt SPN before marking dead');
  assert.equal(outcome.step, 'dead_mark');
  assert.equal(outcome.citation.linkStatus, 'dead');
  // dead_mark must not fabricate a capture or rewrite the location.
  assert.deepEqual(outcome.citation.location, citation.location);
  assert.equal(outcome.citation.capture.waybackCaptureUrl, undefined);
});

test('the full ladder order is exercised end to end as capture availability changes', async () => {
  const now = '2026-07-17T00:00:00.000Z';
  const stepsObserved: string[] = [];

  // Case A: permanent redirect wins outright.
  stepsObserved.push(
    (
      await applyRepairLadder({
        citation: baseCitation(),
        classification: { status: 'redirected', permanentRedirect: true, redirectTarget: 'https://gazette.example/moved' },
        attemptSpn: async () => ({ ok: false, reason: 'unused' }),
        now,
      })
    ).step,
  );

  // Case B: dead + capture present -> wayback_swap, no SPN attempt.
  stepsObserved.push(
    (
      await applyRepairLadder({
        citation: baseCitation({ capture: { captureId: 'c', waybackCaptureUrl: 'https://web.archive.org/web/1/https://gazette.example/story/1' } }),
        classification: { status: 'dead' },
        attemptSpn: async () => {
          throw new Error('unexpected SPN call');
        },
        now,
      })
    ).step,
  );

  // Case C: dead + no capture + SPN succeeds -> retroactive_spn.
  stepsObserved.push(
    (
      await applyRepairLadder({
        citation: baseCitation(),
        classification: { status: 'dead' },
        attemptSpn: async () => ({ ok: true, waybackCaptureUrl: 'https://web.archive.org/web/2/https://gazette.example/story/1', capturedAt: now }),
        now,
      })
    ).step,
  );

  // Case D: dead + no capture + SPN fails -> dead_mark.
  stepsObserved.push(
    (
      await applyRepairLadder({
        citation: baseCitation(),
        classification: { status: 'dead' },
        attemptSpn: async () => ({ ok: false, reason: 'unavailable' }),
        now,
      })
    ).step,
  );

  assert.deepEqual(stepsObserved, ['permanent_redirect', 'wayback_swap', 'retroactive_spn', 'dead_mark']);
});

test('spn-client: buildSpnSaveUrl builds the archive.org save endpoint for a target URL', () => {
  assert.equal(
    buildSpnSaveUrl('https://gazette.example/story/1'),
    'https://web.archive.org/save/https://gazette.example/story/1',
  );
});

test('spn-client: interpretSpnFetchResult only accepts a genuine web.archive.org capture URL', () => {
  const good: SpnCaptureOutcome = interpretSpnFetchResult(
    { ok: true, finalUrl: 'https://web.archive.org/web/20260717000000/https://gazette.example/story/1' },
    '2026-07-17T00:00:00.000Z',
  );
  assert.equal(good.ok, true);

  const bad = interpretSpnFetchResult(
    { ok: true, finalUrl: 'https://gazette.example/story/1' },
    '2026-07-17T00:00:00.000Z',
  );
  assert.equal(bad.ok, false);

  const failed = interpretSpnFetchResult({ ok: false, reason: 'transport_failed' }, '2026-07-17T00:00:00.000Z');
  assert.equal(failed.ok, false);
});
