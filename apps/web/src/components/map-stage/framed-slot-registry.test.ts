/**
 * The one-Framed-slot guard.
 *
 * The cases that matter here are the two React lifecycles that break a naive implementation: a
 * holder re-claiming its own slot on re-render, and an outgoing slot's cleanup running after the
 * incoming slot has already claimed.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFramedSlotRegistry } from './framed-slot-registry';

test('a fresh registry holds nothing', () => {
  assert.equal(createFramedSlotRegistry().holder(), null);
});

test('the first claim is granted', () => {
  const registry = createFramedSlotRegistry();
  assert.equal(registry.claim('chapter-moment-1'), true);
  assert.equal(registry.holder(), 'chapter-moment-1');
});

test('a second claim by a different id is refused and does not displace the holder', () => {
  // The cross-stage case: a record page's place frame and a chapter moment mounted at once.
  // MapMomentStage's arbitration cannot see this, because neither stage knows the other exists.
  const registry = createFramedSlotRegistry();
  registry.claim('record-place');
  assert.equal(registry.claim('chapter-moment-1'), false);
  assert.equal(registry.holder(), 'record-place');
});

test('the holder re-claiming its own slot is granted', () => {
  // A moment re-registers on every re-render and every camera change. If this read as a conflict
  // the holder would lose its slot to itself and the plate would flicker at React's render rate.
  const registry = createFramedSlotRegistry();
  registry.claim('record-place');
  assert.equal(registry.claim('record-place'), true);
  assert.equal(registry.holder(), 'record-place');
});

test('release by a non-holder is inert', () => {
  // React mounts the incoming tree before unmounting the outgoing one, so during navigation the
  // new slot claims and only then does the old slot's cleanup run. An unchecked release would
  // tear down the claim the incoming slot just made and park the plate on a page that wants it.
  const registry = createFramedSlotRegistry();
  registry.claim('incoming');
  registry.release('outgoing');
  assert.equal(registry.holder(), 'incoming');
});

test('release by the holder frees the slot for a previously refused claimant', () => {
  const registry = createFramedSlotRegistry();
  registry.claim('first');
  assert.equal(registry.claim('second'), false);
  registry.release('first');
  assert.equal(registry.holder(), null);
  assert.equal(registry.claim('second'), true);
});

test('releasing an empty registry is inert', () => {
  const registry = createFramedSlotRegistry();
  registry.release('never-claimed');
  assert.equal(registry.holder(), null);
});

test('two registries do not share state', () => {
  const a = createFramedSlotRegistry();
  const b = createFramedSlotRegistry();
  a.claim('slot');
  assert.equal(b.holder(), null);
  assert.equal(b.claim('slot'), true);
});
