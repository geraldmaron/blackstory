/**
 * SP-08 (repo-92n2.8): the Framed posture's transition and geometry.
 *
 * The acceptance criterion these cover is "a Framed plate releases on exit and a second Framed
 * request while one is live is refused". The refusal itself lives in `framed-slot-registry`; what
 * is asserted here is that a refused claim leaves the plate in its RESTING posture rather than in
 * some third state, which is the part a registry test cannot see.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boxIsPaintable, plateBoxForSlot, resolvePlatePosture } from './plate-frame';

/** `document.documentElement`'s rect at scroll offset 0 and at 600px down the page. */
const AT_TOP = { top: 0, left: 0 };
const SCROLLED = { top: -600, left: 0 };

test('a reading room parks until a moment claims the plate, and parks again when it leaves', () => {
  const resting = { surface: 'reading' as const, hasLiveMoment: false, claimGranted: false };
  assert.equal(resolvePlatePosture(resting), 'parked');
  assert.equal(
    resolvePlatePosture({ surface: 'reading', hasLiveMoment: true, claimGranted: true }),
    'framed',
  );
  // Scrolling past the last moment must return the plate, not strand it framed on an empty slot.
  assert.equal(resolvePlatePosture(resting), 'parked');
});

test('a record page rests Framed, because its place block always has something to frame', () => {
  assert.equal(
    resolvePlatePosture({ surface: 'record', hasLiveMoment: false, claimGranted: false }),
    'framed',
  );
});

test('a refused claim leaves the plate at rest rather than in a half-framed state', () => {
  // Two stages mounted at once: the loser of the claim must not also lose its resting posture.
  assert.equal(
    resolvePlatePosture({ surface: 'reading', hasLiveMoment: true, claimGranted: false }),
    'parked',
  );
});

test('Explore refuses a moment claim and keeps steering', () => {
  // A record sheet floating over the live plate mounts a place block. It cannot borrow the plate
  // it is floating over, so the plate stays Live and the block renders its static fallback.
  assert.equal(
    resolvePlatePosture({ surface: 'instrument', hasLiveMoment: true, claimGranted: true }),
    'live',
  );
});

test('a utility surface is never woken by a stray moment', () => {
  assert.equal(
    resolvePlatePosture({ surface: 'utility', hasLiveMoment: true, claimGranted: true }),
    'parked',
  );
  assert.equal(
    resolvePlatePosture({ surface: null, hasLiveMoment: true, claimGranted: true }),
    'parked',
  );
});

test('a slot maps to its own box in document space', () => {
  const box = plateBoxForSlot({ top: 120, left: 200, width: 640, height: 360 }, AT_TOP);
  assert.deepEqual(box, { top: 120, left: 200, width: 640, height: 360 });
  assert.ok(boxIsPaintable(box));
});

test('the same slot yields the same box at any scroll offset', () => {
  // The whole reason the plate is positioned in document space: the box does not move while the
  // reader scrolls, so there is nothing for a main-thread write to lag behind and no frame in
  // which the map sits off its own frame. A slot 120px down the page reads `top: 720` in the
  // viewport once the reader is 600px down, and both describe the same document position.
  const atTop = plateBoxForSlot({ top: 120, left: 200, width: 640, height: 360 }, AT_TOP);
  const scrolled = plateBoxForSlot({ top: -480, left: 200, width: 640, height: 360 }, SCROLLED);
  assert.deepEqual(scrolled, atTop);
});

test('a slot half off the top keeps its full box rather than clamping', () => {
  // A fixed plate had to clamp here, and resizing the box mid-scroll moved the map's own edge.
  // An absolute plate is clipped by the viewport like any other document content.
  const box = plateBoxForSlot({ top: -180, left: 200, width: 640, height: 360 }, AT_TOP);
  assert.deepEqual(box, { top: -180, left: 200, width: 640, height: 360 });
  assert.ok(boxIsPaintable(box));
});

test('a slot below the fold is still a full box, because it scrolls with the page', () => {
  const box = plateBoxForSlot({ top: 900, left: 200, width: 640, height: 360 }, AT_TOP);
  assert.equal(box.top, 900);
  assert.equal(box.height, 360);
  assert.ok(boxIsPaintable(box));
});

test('a zero-area slot yields a box the caller can refuse to paint', () => {
  const box = plateBoxForSlot({ top: 120, left: 200, width: 640, height: 0 }, AT_TOP);
  assert.equal(box.height, 0);
  assert.equal(boxIsPaintable(box), false);
});
